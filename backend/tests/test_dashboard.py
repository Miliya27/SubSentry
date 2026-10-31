"""
Tests for Dashboard APIs (Hour 7).
Coverage:
- Hand-calculated fixture with partial payment and overdue invoice
- Assert summary numbers match hand calculations exactly
- Revenue received counts payments, not invoices
- Customer dashboard shows only own data
- Customer role forbidden on /dashboard/summary (403)
- Admin forbidden on /dashboard/customer (403)
- Upcoming renewals endpoint filters active subs within N days
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.models import Invoice
from tests.conftest import TestingSessionLocal as TestingSession


@pytest.fixture
def client():
    return TestClient(app, raise_server_exceptions=False)


VALID_PASSWORD = "Strong@Pass1"


def seed_user(email: str, role_str: str, full_name: str) -> tuple[int, str]:
    from app.core.security import hash_password
    from app.models.models import RoleEnum, User
    db = TestingSession()
    try:
        user = User(
            email=email,
            hashed_password=hash_password(VALID_PASSWORD),
            full_name=full_name,
            role=RoleEnum(role_str),
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user.id, email
    finally:
        db.close()


def get_token(client: TestClient, email: str) -> str:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": VALID_PASSWORD})
    assert r.status_code == 200, f"Login failed for {email}: {r.text}"
    return r.json()["data"]["access_token"]


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_dashboard_summary_and_hand_calculations(client):
    """
    Hand-calculated scenario:
      Plan 1: 1000.00/month
      Plan 2: 2000.00/month
      Cust 1 (Alpha): Sub 1 active (1000.00). Inv 1 = 1000.00, overdue (due_date in past).
                      Payment of 400.00 recorded -> outstanding = 600.00.
      Cust 2 (Beta):  Sub 2 active (2000.00). Inv 2 = 2000.00, not overdue.
                      Payment of 2000.00 recorded -> status paid, outstanding = 0.00.

    Expected Summary:
      active_subscriptions = 2
      revenue_received     = "2400.00" (400 + 2000)
      total_invoiced       = "3000.00" (1000 + 2000)
      outstanding          = "600.00"
      overdue_count        = 1
      overdue_amount       = "600.00"
      mrr                  = "3000.00"
      arr                  = "36000.00"
    """
    uid = uuid.uuid4().hex[:6]
    seed_user(f"admin_{uid}@test.com", "admin", "Admin")
    admin_token = get_token(client, f"admin_{uid}@test.com")

    # 1. Products & Plans
    rp1 = client.post("/api/v1/products", json={"name": f"P1 {uid}", "sales_price": "1000.00"}, headers=auth(admin_token))
    p1_id = rp1.json()["data"]["id"]
    rpl1 = client.post("/api/v1/plans", json={"name": f"Plan 1 {uid}", "product_id": p1_id, "price": "1000.00", "billing_frequency": "monthly", "min_quantity": 1}, headers=auth(admin_token))
    plan1_id = rpl1.json()["data"]["id"]

    rp2 = client.post("/api/v1/products", json={"name": f"P2 {uid}", "sales_price": "2000.00"}, headers=auth(admin_token))
    p2_id = rp2.json()["data"]["id"]
    rpl2 = client.post("/api/v1/plans", json={"name": f"Plan 2 {uid}", "product_id": p2_id, "price": "2000.00", "billing_frequency": "monthly", "min_quantity": 1}, headers=auth(admin_token))
    plan2_id = rpl2.json()["data"]["id"]

    # 2. Customers
    u1, _ = seed_user(f"c1_{uid}@test.com", "customer", "Alpha User")
    rc1 = client.post("/api/v1/customers", json={"user_id": u1, "company_name": "Alpha Corp"}, headers=auth(admin_token))
    c1_id = rc1.json()["data"]["id"]
    t1 = get_token(client, f"c1_{uid}@test.com")

    u2, _ = seed_user(f"c2_{uid}@test.com", "customer", "Beta User")
    rc2 = client.post("/api/v1/customers", json={"user_id": u2, "company_name": "Beta Corp"}, headers=auth(admin_token))
    c2_id = rc2.json()["data"]["id"]
    t2 = get_token(client, f"c2_{uid}@test.com")

    # 3. Subscriptions (both active)
    s1 = client.post("/api/v1/subscriptions", json={
        "customer_id": c1_id, "plan_id": plan1_id, "start_date": "2026-11-01",
        "lines": [{"quantity": 1}],
    }, headers=auth(admin_token)).json()["data"]["id"]
    client.post(f"/api/v1/subscriptions/{s1}/send-quotation", headers=auth(admin_token))
    client.post(f"/api/v1/subscriptions/{s1}/confirm", headers=auth(admin_token))
    client.post(f"/api/v1/subscriptions/{s1}/activate", headers=auth(admin_token))

    s2 = client.post("/api/v1/subscriptions", json={
        "customer_id": c2_id, "plan_id": plan2_id, "start_date": "2026-11-01",
        "lines": [{"quantity": 1}],
    }, headers=auth(admin_token)).json()["data"]["id"]
    client.post(f"/api/v1/subscriptions/{s2}/send-quotation", headers=auth(admin_token))
    client.post(f"/api/v1/subscriptions/{s2}/confirm", headers=auth(admin_token))
    client.post(f"/api/v1/subscriptions/{s2}/activate", headers=auth(admin_token))

    # 4. Billing Run creates Invoices
    r_run = client.post("/api/v1/billing/run", json={"as_of_date": "2026-11-01"}, headers=auth(admin_token))
    assert r_run.status_code == 200

    all_invs = client.get("/api/v1/invoices", headers=auth(admin_token)).json()["data"]
    inv1_id = [i for i in all_invs if i["customer_id"] == c1_id][0]["id"]
    inv2_id = [i for i in all_invs if i["customer_id"] == c2_id][0]["id"]

    # Confirm both invoices
    client.post(f"/api/v1/invoices/{inv1_id}/confirm", headers=auth(admin_token))
    client.post(f"/api/v1/invoices/{inv2_id}/confirm", headers=auth(admin_token))

    # Make Inv 1 overdue by setting due_date = today - 3 days
    db = TestingSession()
    inv1_db = db.query(Invoice).filter(Invoice.id == inv1_id).first()
    inv1_db.due_date = date.today() - timedelta(days=3)
    db.commit()
    db.close()

    # Partial payment on Inv 1: 400.00
    client.post(f"/api/v1/invoices/{inv1_id}/payments", json={
        "method": "bank_transfer",
        "amount": "400.00",
        "payment_date": str(date.today()),
    }, headers=auth(admin_token))

    # Full payment on Inv 2: 2000.00
    client.post(f"/api/v1/invoices/{inv2_id}/payments", json={
        "method": "upi",
        "amount": "2000.00",
        "payment_date": str(date.today()),
    }, headers=auth(admin_token))

    # 5. Query GET /dashboard/summary (Admin)
    r_sum = client.get("/api/v1/dashboard/summary", headers=auth(admin_token))
    assert r_sum.status_code == 200
    s_data = r_sum.json()["data"]

    assert s_data["active_subscriptions"] == 2
    assert s_data["revenue_received"] == "2400.00"
    assert s_data["total_invoiced"] == "3000.00"
    assert s_data["outstanding"] == "600.00"
    assert s_data["overdue_count"] == 1
    assert s_data["overdue_amount"] == "600.00"
    assert s_data["mrr"] == "3000.00"
    assert s_data["arr"] == "36000.00"

    # 6. Customer Role Forbidden on /dashboard/summary
    r_cust_sum = client.get("/api/v1/dashboard/summary", headers=auth(t1))
    assert r_cust_sum.status_code == 403
    assert r_cust_sum.json()["error"]["code"] == "FORBIDDEN"

    # 7. Customer 1 Dashboard shows ONLY Customer 1 data
    r_c1_dash = client.get("/api/v1/dashboard/customer", headers=auth(t1))
    assert r_c1_dash.status_code == 200
    c1_data = r_c1_dash.json()["data"]
    assert c1_data["active_subscriptions"] == 1
    assert c1_data["total_invoiced"] == "1000.00"
    assert c1_data["amount_paid"] == "400.00"
    assert c1_data["outstanding"] == "600.00"
    assert c1_data["overdue_count"] == 1

    # 8. Customer 2 Dashboard shows ONLY Customer 2 data
    r_c2_dash = client.get("/api/v1/dashboard/customer", headers=auth(t2))
    assert r_c2_dash.status_code == 200
    c2_data = r_c2_dash.json()["data"]
    assert c2_data["active_subscriptions"] == 1
    assert c2_data["total_invoiced"] == "2000.00"
    assert c2_data["amount_paid"] == "2000.00"
    assert c2_data["outstanding"] == "0.00"
    assert c2_data["overdue_count"] == 0

    # 9. Admin role forbidden on /dashboard/customer
    r_admin_cust_dash = client.get("/api/v1/dashboard/customer", headers=auth(admin_token))
    assert r_admin_cust_dash.status_code == 403


def test_upcoming_renewals_endpoint(client):
    uid = uuid.uuid4().hex[:6]
    seed_user(f"admin_renew_{uid}@test.com", "admin", "Admin")
    admin_token = get_token(client, f"admin_renew_{uid}@test.com")

    rp = client.post("/api/v1/products", json={"name": f"P {uid}", "sales_price": "500.00"}, headers=auth(admin_token))
    pid = rp.json()["data"]["id"]
    rpl = client.post("/api/v1/plans", json={"name": f"Plan {uid}", "product_id": pid, "price": "500.00", "billing_frequency": "monthly", "min_quantity": 1}, headers=auth(admin_token))
    plan_id = rpl.json()["data"]["id"]

    u, _ = seed_user(f"cust_renew_{uid}@test.com", "customer", "Renew Cust")
    rc = client.post("/api/v1/customers", json={"user_id": u, "company_name": "Renew Corp"}, headers=auth(admin_token))
    cust_id = rc.json()["data"]["id"]

    # Active subscription with next_billing_date in 10 days
    renew_date = str(date.today() + timedelta(days=10))
    s = client.post("/api/v1/subscriptions", json={
        "customer_id": cust_id, "plan_id": plan_id, "start_date": "2026-11-01",
        "lines": [{"quantity": 2}],
    }, headers=auth(admin_token)).json()["data"]["id"]
    client.post(f"/api/v1/subscriptions/{s}/send-quotation", headers=auth(admin_token))
    client.post(f"/api/v1/subscriptions/{s}/confirm", headers=auth(admin_token))
    client.post(f"/api/v1/subscriptions/{s}/activate", headers=auth(admin_token))

    # Update next_billing_date to 10 days from now
    db = TestingSession()
    from app.models.models import Subscription
    sub_db = db.query(Subscription).filter(Subscription.id == s).first()
    sub_db.next_billing_date = date.today() + timedelta(days=10)
    db.commit()
    db.close()

    r_up = client.get("/api/v1/dashboard/upcoming-renewals?days=30", headers=auth(admin_token))
    assert r_up.status_code == 200
    items = r_up.json()["data"]
    sub_ids = [it["subscription_id"] for it in items]
    assert s in sub_ids

    # Matching item verification
    matching = [it for it in items if it["subscription_id"] == s][0]
    assert matching["customer_name"] == "Renew Corp"
    assert matching["next_billing_date"] == renew_date
    assert matching["total"] == "1000.00"

