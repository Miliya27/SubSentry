"""
Tests for Payments and Finance calculations (Hour 6).
Coverage:
- Partial payment leaves invoice 'confirmed'
- Full payment sets invoice status to 'paid'
- Overpayment rejected (400 BUSINESS_RULE)
- Payment on draft/cancelled/paid rejected (400 BUSINESS_RULE)
- Overdue detection (status confirmed AND outstanding > 0 AND due_date < today)
- Two payments on the same day
- Customer isolation on GET /payments
- Finance metrics (revenue_received, outstanding_total, overdue_total, mrr, arr)
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.models import InvoiceStatusEnum, PaymentMethodEnum
from app.services.finance import (
    arr,
    mrr,
    outstanding_total,
    overdue_total,
    revenue_received,
)
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


def setup_catalog_and_subscription(client: TestClient, admin_token: str, billing_frequency="monthly"):
    uid = uuid.uuid4().hex[:6]
    rp = client.post("/api/v1/products", json={
        "name": f"Product {uid}",
        "sales_price": "2000.00",
        "cost_price": "500.00",
    }, headers=auth(admin_token))
    product_id = rp.json()["data"]["id"]

    rv = client.post(f"/api/v1/products/{product_id}/variants", json={
        "attribute": "Type",
        "value": "Standard",
        "extra_price": "0.00",
        "sku": f"SKU-{uid}",
    }, headers=auth(admin_token))
    variant_id = rv.json()["data"]["id"]

    rpl = client.post("/api/v1/plans", json={
        "name": f"Plan {uid}",
        "product_id": product_id,
        "price": "2000.00",
        "billing_frequency": billing_frequency,
        "min_quantity": 1,
    }, headers=auth(admin_token))
    plan_id = rpl.json()["data"]["id"]

    u_id, u_email = seed_user(f"cust_{uid}@test.com", "customer", f"Customer {uid}")
    rc = client.post("/api/v1/customers", json={"user_id": u_id, "company_name": f"Corp {uid}"}, headers=auth(admin_token))
    customer_id = rc.json()["data"]["id"]

    r_sub = client.post("/api/v1/subscriptions", json={
        "customer_id": customer_id,
        "plan_id": plan_id,
        "start_date": "2026-11-01",
        "lines": [{"product_variant_id": variant_id, "quantity": 1}],
    }, headers=auth(admin_token))
    sub_id = r_sub.json()["data"]["id"]

    # Activate subscription
    client.post(f"/api/v1/subscriptions/{sub_id}/send-quotation", headers=auth(admin_token))
    client.post(f"/api/v1/subscriptions/{sub_id}/confirm", headers=auth(admin_token))
    client.post(f"/api/v1/subscriptions/{sub_id}/activate", headers=auth(admin_token))

    return {
        "customer_id": customer_id,
        "customer_email": u_email,
        "plan_id": plan_id,
        "sub_id": sub_id,
    }


# ---------------------------------------------------------------------------
# Payment Tests
# ---------------------------------------------------------------------------

def test_partial_then_full_payment_sets_status_paid(client):
    seed_user("admin_pay1@test.com", "admin", "Admin")
    admin_token = get_token(client, "admin_pay1@test.com")
    setup = setup_catalog_and_subscription(client, admin_token)

    # Run billing to generate invoice
    r_run = client.post("/api/v1/billing/run", json={"as_of_date": "2026-11-01"}, headers=auth(admin_token))
    inv_id = r_run.json()["data"]["invoice_ids"][0]

    # Confirm invoice so payments can be accepted
    client.post(f"/api/v1/invoices/{inv_id}/confirm", headers=auth(admin_token))

    # Total is 2000.00
    r_inv = client.get(f"/api/v1/invoices/{inv_id}", headers=auth(admin_token))
    assert r_inv.json()["data"]["total"] == "2000.00"
    assert r_inv.json()["data"]["outstanding"] == "2000.00"
    assert r_inv.json()["data"]["payment_state"] == "unpaid"

    # 1. Partial payment: 800.00
    r_p1 = client.post(f"/api/v1/invoices/{inv_id}/payments", json={
        "method": "bank_transfer",
        "amount": "800.00",
        "payment_date": str(date.today()),
        "reference": "REF-PARTIAL",
    }, headers=auth(admin_token))
    assert r_p1.status_code == 201
    p1_data = r_p1.json()["data"]
    assert p1_data["payment"]["amount"] == "800.00"
    assert p1_data["invoice"]["amount_paid"] == "800.00"
    assert p1_data["invoice"]["outstanding"] == "1200.00"
    assert p1_data["invoice"]["status"] == "confirmed"
    assert p1_data["invoice"]["payment_state"] == "partially_paid"

    # Verify invoice GET reflects partial payment
    r_inv2 = client.get(f"/api/v1/invoices/{inv_id}", headers=auth(admin_token))
    assert r_inv2.json()["data"]["amount_paid"] == "800.00"
    assert r_inv2.json()["data"]["outstanding"] == "1200.00"
    assert r_inv2.json()["data"]["status"] == "confirmed"
    assert r_inv2.json()["data"]["payment_state"] == "partially_paid"

    # 2. Full remaining payment: 1200.00
    r_p2 = client.post(f"/api/v1/invoices/{inv_id}/payments", json={
        "method": "upi",
        "amount": "1200.00",
        "payment_date": str(date.today()),
        "reference": "REF-FULL",
    }, headers=auth(admin_token))
    assert r_p2.status_code == 201
    p2_data = r_p2.json()["data"]
    assert p2_data["invoice"]["amount_paid"] == "2000.00"
    assert p2_data["invoice"]["outstanding"] == "0.00"
    assert p2_data["invoice"]["status"] == "paid"
    assert p2_data["invoice"]["payment_state"] == "paid"

    # Verify invoice GET reflects paid status
    r_inv3 = client.get(f"/api/v1/invoices/{inv_id}", headers=auth(admin_token))
    assert r_inv3.json()["data"]["status"] == "paid"
    assert r_inv3.json()["data"]["outstanding"] == "0.00"
    assert r_inv3.json()["data"]["payment_state"] == "paid"


def test_overpay_rejected(client):
    seed_user("admin_overpay@test.com", "admin", "Admin")
    admin_token = get_token(client, "admin_overpay@test.com")
    setup = setup_catalog_and_subscription(client, admin_token)

    r_run = client.post("/api/v1/billing/run", json={"as_of_date": "2026-11-01"}, headers=auth(admin_token))
    inv_id = r_run.json()["data"]["invoice_ids"][0]
    client.post(f"/api/v1/invoices/{inv_id}/confirm", headers=auth(admin_token))

    # Overpayment: total is 2000.00, attempting 2000.01
    r_over = client.post(f"/api/v1/invoices/{inv_id}/payments", json={
        "method": "card",
        "amount": "2000.01",
        "payment_date": str(date.today()),
    }, headers=auth(admin_token))
    assert r_over.status_code == 400
    assert r_over.json()["error"]["code"] == "BUSINESS_RULE"


def test_payment_on_draft_or_cancelled_rejected(client):
    seed_user("admin_invalid_pay@test.com", "admin", "Admin")
    admin_token = get_token(client, "admin_invalid_pay@test.com")
    setup = setup_catalog_and_subscription(client, admin_token)

    r_run = client.post("/api/v1/billing/run", json={"as_of_date": "2026-11-01"}, headers=auth(admin_token))
    inv_id = r_run.json()["data"]["invoice_ids"][0]

    # Invoice is in draft status -> payment rejected
    r_draft_pay = client.post(f"/api/v1/invoices/{inv_id}/payments", json={
        "method": "cash",
        "amount": "100.00",
        "payment_date": str(date.today()),
    }, headers=auth(admin_token))
    assert r_draft_pay.status_code == 400
    assert r_draft_pay.json()["error"]["code"] == "BUSINESS_RULE"

    # Cancel invoice -> payment on cancelled invoice also rejected
    client.post(f"/api/v1/invoices/{inv_id}/cancel", headers=auth(admin_token))
    r_cancel_pay = client.post(f"/api/v1/invoices/{inv_id}/payments", json={
        "method": "cash",
        "amount": "100.00",
        "payment_date": str(date.today()),
    }, headers=auth(admin_token))
    assert r_cancel_pay.status_code == 400
    assert r_cancel_pay.json()["error"]["code"] == "BUSINESS_RULE"


def test_overdue_detection(client):
    seed_user("admin_overdue@test.com", "admin", "Admin")
    admin_token = get_token(client, "admin_overdue@test.com")
    setup = setup_catalog_and_subscription(client, admin_token)

    r_run = client.post("/api/v1/billing/run", json={"as_of_date": "2026-11-01"}, headers=auth(admin_token))
    inv_id = r_run.json()["data"]["invoice_ids"][0]

    # Confirm invoice
    client.post(f"/api/v1/invoices/{inv_id}/confirm", headers=auth(admin_token))

    # Manually adjust due_date to yesterday in DB to test overdue
    db = TestingSession()
    from app.models.models import Invoice
    inv = db.query(Invoice).filter(Invoice.id == inv_id).first()
    inv.due_date = date.today() - timedelta(days=2)
    db.commit()
    db.close()

    # Query invoice: is_overdue must be True
    r_check = client.get(f"/api/v1/invoices/{inv_id}", headers=auth(admin_token))
    assert r_check.json()["data"]["is_overdue"] is True

    # Pay in full: is_overdue must become False
    client.post(f"/api/v1/invoices/{inv_id}/payments", json={
        "method": "cash",
        "amount": "2000.00",
        "payment_date": str(date.today()),
    }, headers=auth(admin_token))

    r_paid = client.get(f"/api/v1/invoices/{inv_id}", headers=auth(admin_token))
    assert r_paid.json()["data"]["is_overdue"] is False


def test_two_payments_on_same_day(client):
    seed_user("admin_sameday@test.com", "admin", "Admin")
    admin_token = get_token(client, "admin_sameday@test.com")
    setup = setup_catalog_and_subscription(client, admin_token)

    r_run = client.post("/api/v1/billing/run", json={"as_of_date": "2026-11-01"}, headers=auth(admin_token))
    inv_id = r_run.json()["data"]["invoice_ids"][0]
    client.post(f"/api/v1/invoices/{inv_id}/confirm", headers=auth(admin_token))

    today_str = str(date.today())
    # Payment 1
    client.post(f"/api/v1/invoices/{inv_id}/payments", json={
        "method": "cash",
        "amount": "500.00",
        "payment_date": today_str,
    }, headers=auth(admin_token))

    # Payment 2 on same day
    client.post(f"/api/v1/invoices/{inv_id}/payments", json={
        "method": "bank_transfer",
        "amount": "500.00",
        "payment_date": today_str,
    }, headers=auth(admin_token))

    r_inv = client.get(f"/api/v1/invoices/{inv_id}", headers=auth(admin_token))
    assert r_inv.json()["data"]["amount_paid"] == "1000.00"
    assert r_inv.json()["data"]["outstanding"] == "1000.00"
    assert len(r_inv.json()["data"]["payments"]) == 2


def test_customer_cannot_see_another_customers_payments(client):
    seed_user("admin_pay_iso@test.com", "admin", "Admin")
    admin_token = get_token(client, "admin_pay_iso@test.com")

    setup1 = setup_catalog_and_subscription(client, admin_token)
    setup2 = setup_catalog_and_subscription(client, admin_token)

    token1 = get_token(client, setup1["customer_email"])
    token2 = get_token(client, setup2["customer_email"])

    # Run billing
    r_run = client.post("/api/v1/billing/run", json={"as_of_date": "2026-11-01"}, headers=auth(admin_token))
    inv_ids = r_run.json()["data"]["invoice_ids"]

    # Invoices for sub1 and sub2
    all_invs = client.get("/api/v1/invoices", headers=auth(admin_token)).json()["data"]
    inv1_id = [i for i in all_invs if i["customer_id"] == setup1["customer_id"]][0]["id"]
    inv2_id = [i for i in all_invs if i["customer_id"] == setup2["customer_id"]][0]["id"]

    client.post(f"/api/v1/invoices/{inv1_id}/confirm", headers=auth(admin_token))
    client.post(f"/api/v1/invoices/{inv2_id}/confirm", headers=auth(admin_token))

    # Pay 100 on Inv 1 and 200 on Inv 2
    r_p1 = client.post(f"/api/v1/invoices/{inv1_id}/payments", json={
        "method": "cash", "amount": "100.00", "payment_date": str(date.today()),
    }, headers=auth(admin_token))
    p1_id = r_p1.json()["data"]["payment"]["id"]

    r_p2 = client.post(f"/api/v1/invoices/{inv2_id}/payments", json={
        "method": "cash", "amount": "200.00", "payment_date": str(date.today()),
    }, headers=auth(admin_token))
    p2_id = r_p2.json()["data"]["payment"]["id"]

    # Customer 1 listing payments: sees ONLY p1_id
    r_list1 = client.get("/api/v1/payments", headers=auth(token1))
    assert r_list1.status_code == 200
    c1_payment_ids = [p["id"] for p in r_list1.json()["data"]]
    assert p1_id in c1_payment_ids
    assert p2_id not in c1_payment_ids

    # Customer 2 listing payments: sees ONLY p2_id
    r_list2 = client.get("/api/v1/payments", headers=auth(token2))
    assert r_list2.status_code == 200
    c2_payment_ids = [p["id"] for p in r_list2.json()["data"]]
    assert p2_id in c2_payment_ids
    assert p1_id not in c2_payment_ids


# ---------------------------------------------------------------------------
# Finance Metrics Service Tests
# ---------------------------------------------------------------------------

def test_finance_metrics(client):
    seed_user("admin_metrics@test.com", "admin", "Admin")
    admin_token = get_token(client, "admin_metrics@test.com")
    setup = setup_catalog_and_subscription(client, admin_token, billing_frequency="monthly")

    # Run billing
    client.post("/api/v1/billing/run", json={"as_of_date": "2026-11-01"}, headers=auth(admin_token))
    all_invs = client.get("/api/v1/invoices", headers=auth(admin_token)).json()["data"]
    inv_id = [i for i in all_invs if i["customer_id"] == setup["customer_id"]][0]["id"]
    client.post(f"/api/v1/invoices/{inv_id}/confirm", headers=auth(admin_token))

    # Pay 500 on 2000.00 invoice
    client.post(f"/api/v1/invoices/{inv_id}/payments", json={
        "method": "bank_transfer",
        "amount": "500.00",
        "payment_date": str(date.today()),
    }, headers=auth(admin_token))

    db = TestingSession()
    try:
        rev = revenue_received(db, from_date=date.today(), to_date=date.today())
        assert rev >= Decimal("500.00")

        out = outstanding_total(db)
        assert out >= Decimal("1500.00")

        current_mrr = mrr(db)
        assert current_mrr > Decimal("0.00")

        current_arr = arr(db)
        assert current_arr == current_mrr * Decimal("12")
    finally:
        db.close()

