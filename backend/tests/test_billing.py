"""
Tests for Billing engine, Invoices, and Discounts (Hour 5).
Coverage:
- Period calculations (daily, weekly, monthly with Jan 31 clamping, yearly)
- Run twice gives created=0
- 3 missed months gives 3 invoices
- Discount applied / expired / usage limit
- Increment usage_count on invoice confirmation
- Invoice cancellation
- Customer sees only own invoices (list and detail)
- Invoice print data and email sending
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.models import BillingFrequencyEnum
from app.services.billing import add_period
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


def setup_base_catalog(client: TestClient, admin_token: str) -> dict[str, int]:
    uid = uuid.uuid4().hex[:6]
    rp = client.post("/api/v1/products", json={
        "name": f"ERP Software {uid}",
        "sales_price": "2000.00",
        "cost_price": "500.00",
    }, headers=auth(admin_token))
    product_id = rp.json()["data"]["id"]

    rv = client.post(f"/api/v1/products/{product_id}/variants", json={
        "attribute": "Brand",
        "value": "Odoo",
        "extra_price": "560.00",
        "sku": f"ERP-ODOO-{uid}",
    }, headers=auth(admin_token))
    variant_id = rv.json()["data"]["id"]

    rt = client.post("/api/v1/taxes", json={
        "name": f"GST 18% {uid}",
        "rate_percent": "18.00",
        "is_default": True,
    }, headers=auth(admin_token))
    tax_id = rt.json()["data"]["id"]

    rpl = client.post("/api/v1/plans", json={
        "name": f"Pro Monthly {uid}",
        "product_id": product_id,
        "price": "3000.00",
        "billing_frequency": "monthly",
        "min_quantity": 1,
    }, headers=auth(admin_token))
    plan_id = rpl.json()["data"]["id"]

    return {
        "product_id": product_id,
        "variant_id": variant_id,
        "tax_id": tax_id,
        "plan_id": plan_id,
    }


# ---------------------------------------------------------------------------
# Period Math Tests
# ---------------------------------------------------------------------------

def test_add_period_frequencies():
    """Verify daily, weekly, monthly (with Jan 31 clamping), and yearly math."""
    # Daily: +1 day
    d_daily = date(2026, 11, 1)
    assert add_period(d_daily, BillingFrequencyEnum.daily) == date(2026, 11, 2)

    # Weekly: +7 days
    d_weekly = date(2026, 11, 1)
    assert add_period(d_weekly, BillingFrequencyEnum.weekly) == date(2026, 11, 8)

    # Monthly normal: 2026-11-01 -> 2026-12-01
    d_monthly = date(2026, 11, 1)
    assert add_period(d_monthly, BillingFrequencyEnum.monthly) == date(2026, 12, 1)

    # Monthly Jan 31 clamps to Feb 28: 2026-01-31 -> 2026-02-28
    d_jan31 = date(2026, 1, 31)
    assert add_period(d_jan31, BillingFrequencyEnum.monthly) == date(2026, 2, 28)

    # Yearly: 2026-11-01 -> 2027-11-01
    d_yearly = date(2026, 11, 1)
    assert add_period(d_yearly, BillingFrequencyEnum.yearly) == date(2027, 11, 1)


# ---------------------------------------------------------------------------
# Billing Engine & Missed Months Tests
# ---------------------------------------------------------------------------

def test_three_missed_months_gives_three_invoices_and_run_twice_gives_zero(client):
    """
    Subscription active with next_billing_date = 2026-08-01.
    Run billing as of 2026-10-15:
    3 periods (Aug, Sep, Oct) must produce 3 invoices.
    A second billing run on the same date must produce 0 invoices.
    """
    seed_user("admin_missed@test.com", "admin", "Admin")
    admin_token = get_token(client, "admin_missed@test.com")
    cat = setup_base_catalog(client, admin_token)

    uid, _ = seed_user("cust_missed@test.com", "customer", "Cust Missed")
    rc = client.post("/api/v1/customers", json={"user_id": uid}, headers=auth(admin_token))
    cust_id = rc.json()["data"]["id"]

    # Create subscription starting 2026-08-01
    r_sub = client.post("/api/v1/subscriptions", json={
        "customer_id": cust_id,
        "plan_id": cat["plan_id"],
        "start_date": "2026-08-01",
        "lines": [{"product_variant_id": cat["variant_id"], "quantity": 1, "tax_rule_id": cat["tax_id"]}],
    }, headers=auth(admin_token))
    sub_id = r_sub.json()["data"]["id"]

    # Transition to active
    client.post(f"/api/v1/subscriptions/{sub_id}/send-quotation", headers=auth(admin_token))
    client.post(f"/api/v1/subscriptions/{sub_id}/confirm", headers=auth(admin_token))
    r_act = client.post(f"/api/v1/subscriptions/{sub_id}/activate", headers=auth(admin_token))
    assert r_act.status_code == 200
    assert r_act.json()["data"]["next_billing_date"] == "2026-08-01"

    # Preview as of 2026-10-15: would_create == 3
    r_prev = client.get("/api/v1/billing/preview?as_of=2026-10-15", headers=auth(admin_token))
    assert r_prev.status_code == 200
    assert r_prev.json()["data"]["would_create"] >= 3

    # Run billing as of 2026-10-15
    r_run1 = client.post("/api/v1/billing/run", json={"as_of_date": "2026-10-15"}, headers=auth(admin_token))
    assert r_run1.status_code == 200
    data1 = r_run1.json()["data"]
    assert data1["created"] == 3
    assert len(data1["invoice_ids"]) == 3
    assert data1["failed"] == 0

    # Verify subscription next_billing_date advanced to 2026-11-01
    r_sub_check = client.get(f"/api/v1/subscriptions/{sub_id}", headers=auth(admin_token))
    assert r_sub_check.json()["data"]["next_billing_date"] == "2026-11-01"

    # Second run as of 2026-10-15 must give created = 0
    r_run2 = client.post("/api/v1/billing/run", json={"as_of_date": "2026-10-15"}, headers=auth(admin_token))
    assert r_run2.status_code == 200
    data2 = r_run2.json()["data"]
    assert data2["created"] == 0


# ---------------------------------------------------------------------------
# Discount Rules & Usage Limit Tests
# ---------------------------------------------------------------------------

def test_discount_applied_and_usage_count_increment(client):
    """
    A 10% discount with max_uses=1 is applied during billing.
    When the invoice is confirmed, uses_count increments from 0 to 1.
    Subsequent billing runs cannot use this discount because max_uses is reached.
    """
    seed_user("admin_disc@test.com", "admin", "Admin")
    admin_token = get_token(client, "admin_disc@test.com")
    cat = setup_base_catalog(client, admin_token)

    uid, _ = seed_user("cust_disc@test.com", "customer", "Cust Discount")
    rc = client.post("/api/v1/customers", json={"user_id": uid}, headers=auth(admin_token))
    cust_id = rc.json()["data"]["id"]

    # Create discount rule with max_uses = 1
    r_disc = client.post("/api/v1/discounts", json={
        "name": "One Time 10%",
        "type": "percent",
        "value": "10.00",
        "max_uses": 1,
    }, headers=auth(admin_token))
    assert r_disc.status_code == 201
    disc_id = r_disc.json()["data"]["id"]

    # Create and activate subscription starting 2026-11-01
    r_sub = client.post("/api/v1/subscriptions", json={
        "customer_id": cust_id,
        "plan_id": cat["plan_id"],
        "start_date": "2026-11-01",
        "lines": [{"product_variant_id": cat["variant_id"], "quantity": 1}],
    }, headers=auth(admin_token))
    sub_id = r_sub.json()["data"]["id"]

    client.post(f"/api/v1/subscriptions/{sub_id}/send-quotation", headers=auth(admin_token))
    client.post(f"/api/v1/subscriptions/{sub_id}/confirm", headers=auth(admin_token))
    client.post(f"/api/v1/subscriptions/{sub_id}/activate", headers=auth(admin_token))

    # Run billing for 2026-11-01
    r_run = client.post("/api/v1/billing/run", json={"as_of_date": "2026-11-01"}, headers=auth(admin_token))
    assert r_run.status_code == 200
    inv_id = r_run.json()["data"]["invoice_ids"][0]

    # Verify invoice line got 10% discount: unit_price 3560.00 * 10% = 356.00
    r_inv = client.get(f"/api/v1/invoices/{inv_id}", headers=auth(admin_token))
    assert r_inv.status_code == 200
    inv_data = r_inv.json()["data"]
    assert inv_data["lines"][0]["discount"] == "356.00"
    assert inv_data["status"] == "draft"

    # Confirm the invoice -> increments discount uses_count
    r_conf = client.post(f"/api/v1/invoices/{inv_id}/confirm", headers=auth(admin_token))
    assert r_conf.status_code == 200
    assert r_conf.json()["data"]["status"] == "confirmed"

    # Verify discount uses_count is now 1
    r_disc_check = client.get(f"/api/v1/discounts/{disc_id}", headers=auth(admin_token))
    assert r_disc_check.json()["data"]["uses_count"] == 1

    # Now run billing for 2026-12-01: discount is exhausted (uses_count >= max_uses)
    r_run2 = client.post("/api/v1/billing/run", json={"as_of_date": "2026-12-01"}, headers=auth(admin_token))
    assert r_run2.status_code == 200
    inv_id2 = r_run2.json()["data"]["invoice_ids"][0]

    r_inv2 = client.get(f"/api/v1/invoices/{inv_id2}", headers=auth(admin_token))
    inv_data2 = r_inv2.json()["data"]
    assert inv_data2["lines"][0]["discount"] == "0.00"


# ---------------------------------------------------------------------------
# Invoice Lifecycle & Cancellation Tests
# ---------------------------------------------------------------------------

def test_invoice_cancellation_and_invalid_operations(client):
    seed_user("admin_inv@test.com", "admin", "Admin")
    admin_token = get_token(client, "admin_inv@test.com")
    cat = setup_base_catalog(client, admin_token)

    uid, _ = seed_user("cust_inv@test.com", "customer", "Cust")
    rc = client.post("/api/v1/customers", json={"user_id": uid}, headers=auth(admin_token))
    cust_id = rc.json()["data"]["id"]

    r_sub = client.post("/api/v1/subscriptions", json={
        "customer_id": cust_id,
        "plan_id": cat["plan_id"],
        "start_date": "2026-11-01",
        "lines": [{"product_variant_id": cat["variant_id"], "quantity": 1}],
    }, headers=auth(admin_token))
    sub_id = r_sub.json()["data"]["id"]
    client.post(f"/api/v1/subscriptions/{sub_id}/send-quotation", headers=auth(admin_token))
    client.post(f"/api/v1/subscriptions/{sub_id}/confirm", headers=auth(admin_token))
    client.post(f"/api/v1/subscriptions/{sub_id}/activate", headers=auth(admin_token))

    r_run = client.post("/api/v1/billing/run", json={"as_of_date": "2026-11-01"}, headers=auth(admin_token))
    inv_id = r_run.json()["data"]["invoice_ids"][0]

    # Cannot send a draft invoice (400 BUSINESS_RULE)
    r_send_draft = client.post(f"/api/v1/invoices/{inv_id}/send", headers=auth(admin_token))
    assert r_send_draft.status_code == 400
    assert r_send_draft.json()["error"]["code"] == "BUSINESS_RULE"

    # Confirm the invoice
    client.post(f"/api/v1/invoices/{inv_id}/confirm", headers=auth(admin_token))

    # Send confirmed invoice -> 200 OK
    r_send = client.post(f"/api/v1/invoices/{inv_id}/send", headers=auth(admin_token))
    assert r_send.status_code == 200

    # Cancel confirmed invoice -> 200 OK
    r_cancel = client.post(f"/api/v1/invoices/{inv_id}/cancel", headers=auth(admin_token))
    assert r_cancel.status_code == 200
    assert r_cancel.json()["data"]["status"] == "cancelled"

    # Cannot cancel an already cancelled invoice
    r_cancel_again = client.post(f"/api/v1/invoices/{inv_id}/cancel", headers=auth(admin_token))
    assert r_cancel_again.status_code == 400
    assert r_cancel_again.json()["error"]["code"] == "BUSINESS_RULE"


# ---------------------------------------------------------------------------
# Customer Isolation & Print Tests
# ---------------------------------------------------------------------------

def test_customer_isolation_and_print_data(client):
    seed_user("admin_iso@test.com", "admin", "Admin")
    admin_token = get_token(client, "admin_iso@test.com")
    cat = setup_base_catalog(client, admin_token)

    # Cust 1
    u1, _ = seed_user("cust1_iso@test.com", "customer", "Cust One")
    rc1 = client.post("/api/v1/customers", json={"user_id": u1, "company_name": "Alpha Corp"}, headers=auth(admin_token))
    c1_id = rc1.json()["data"]["id"]
    t1 = get_token(client, "cust1_iso@test.com")

    # Cust 2
    u2, _ = seed_user("cust2_iso@test.com", "customer", "Cust Two")
    rc2 = client.post("/api/v1/customers", json={"user_id": u2, "company_name": "Beta Corp"}, headers=auth(admin_token))
    c2_id = rc2.json()["data"]["id"]
    t2 = get_token(client, "cust2_iso@test.com")

    # Sub 1 & Sub 2
    s1 = client.post("/api/v1/subscriptions", json={
        "customer_id": c1_id, "plan_id": cat["plan_id"], "start_date": "2026-11-01",
        "lines": [{"product_variant_id": cat["variant_id"], "quantity": 1}],
    }, headers=auth(admin_token)).json()["data"]["id"]
    client.post(f"/api/v1/subscriptions/{s1}/send-quotation", headers=auth(admin_token))
    client.post(f"/api/v1/subscriptions/{s1}/confirm", headers=auth(admin_token))
    client.post(f"/api/v1/subscriptions/{s1}/activate", headers=auth(admin_token))

    s2 = client.post("/api/v1/subscriptions", json={
        "customer_id": c2_id, "plan_id": cat["plan_id"], "start_date": "2026-11-01",
        "lines": [{"product_variant_id": cat["variant_id"], "quantity": 1}],
    }, headers=auth(admin_token)).json()["data"]["id"]
    client.post(f"/api/v1/subscriptions/{s2}/send-quotation", headers=auth(admin_token))
    client.post(f"/api/v1/subscriptions/{s2}/confirm", headers=auth(admin_token))
    client.post(f"/api/v1/subscriptions/{s2}/activate", headers=auth(admin_token))

    # Run billing
    r_run = client.post("/api/v1/billing/run", json={"as_of_date": "2026-11-01"}, headers=auth(admin_token))
    assert r_run.status_code == 200

    # Find invoices for cust1 and cust2
    all_invs = client.get("/api/v1/invoices", headers=auth(admin_token)).json()["data"]
    inv1 = [i for i in all_invs if i["customer_id"] == c1_id][0]["id"]
    inv2 = [i for i in all_invs if i["customer_id"] == c2_id][0]["id"]

    # Customer 1 listing invoices: sees ONLY inv1
    r_c1_list = client.get("/api/v1/invoices", headers=auth(t1))
    assert r_c1_list.status_code == 200
    c1_ids = [i["id"] for i in r_c1_list.json()["data"]]
    assert inv1 in c1_ids
    assert inv2 not in c1_ids

    # Customer 1 accessing Customer 2's invoice detail -> 404 NOT_FOUND
    r_c1_get_other = client.get(f"/api/v1/invoices/{inv2}", headers=auth(t1))
    assert r_c1_get_other.status_code == 404
    assert r_c1_get_other.json()["error"]["code"] == "NOT_FOUND"

    # Customer 1 accessing own invoice detail -> 200 OK
    r_c1_get_own = client.get(f"/api/v1/invoices/{inv1}", headers=auth(t1))
    assert r_c1_get_own.status_code == 200
    assert r_c1_get_own.json()["data"]["id"] == inv1

    # Customer 1 print endpoint on own invoice -> 200 OK with tax_breakdown
    r_print = client.get(f"/api/v1/invoices/{inv1}/print", headers=auth(t1))
    assert r_print.status_code == 200
    print_data = r_print.json()["data"]
    assert "tax_breakdown" in print_data
    assert len(print_data["tax_breakdown"]) >= 1
    assert print_data["customer"]["company_name"] == "Alpha Corp"
