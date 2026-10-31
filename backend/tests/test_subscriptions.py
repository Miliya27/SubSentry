"""
Tests for customers, quotation templates, and subscriptions (Stage: Hour 4).
Tests coverage:
- Customer CRUD & role isolation
- Quotation templates CRUD with validity_days
- Subscription creation with SUB-YYYY-NNNNN format and price snapshot
- Invalid quantity (422)
- Plan availability & expiry validation (400/422)
- Subscription from template (quotation_valid_until calculation)
- Pricing totals (subtotal, tax_amount, total)
- Lifecycle happy path
- Illegal transitions (400)
- Plan guards (pause disallowed, renewal, early close disallowed)
- Customer role isolation (query filtering & 404 on other's subscription)
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import TestingSessionLocal as TestingSession


@pytest.fixture
def client():
    return TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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
    return r.json()["data"]["access_token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def setup_catalog(client: TestClient, admin_token: str) -> dict:
    # 1. Product
    rp = client.post("/api/v1/products", json={
        "name": "ERP Software",
        "sales_price": "2000.00",
        "cost_price": "500.00",
    }, headers=auth(admin_token))
    product_id = rp.json()["data"]["id"]

    # 2. Variant (Odoo +560.00)
    rv = client.post(f"/api/v1/products/{product_id}/variants", json={
        "attribute": "Brand",
        "value": "Odoo",
        "extra_price": "560.00",
        "sku": "ERP-ODOO",
    }, headers=auth(admin_token))
    variant_id = rv.json()["data"]["id"]

    # 3. Tax Rule (GST 18%)
    rt = client.post("/api/v1/taxes", json={
        "name": "GST 18%",
        "rate_percent": "18.00",
        "is_default": True,
    }, headers=auth(admin_token))
    tax_id = rt.json()["data"]["id"]

    # 4. Standard Plan (min_quantity=2, allow_pause=True, allow_renewal=True, allow_early_close=True)
    rpl = client.post("/api/v1/plans", json={
        "name": "Pro Monthly",
        "product_id": product_id,
        "price": "3000.00",
        "billing_frequency": "monthly",
        "min_quantity": 2,
        "allow_pause": True,
        "allow_renewal": True,
        "allow_early_close": True,
    }, headers=auth(admin_token))
    plan_id = rpl.json()["data"]["id"]

    # 5. Strict Plan (allow_pause=False, allow_renewal=False, allow_early_close=False)
    rpl_strict = client.post("/api/v1/plans", json={
        "name": "Strict Monthly",
        "product_id": product_id,
        "price": "3000.00",
        "billing_frequency": "monthly",
        "min_quantity": 1,
        "allow_pause": False,
        "allow_renewal": False,
        "allow_early_close": False,
    }, headers=auth(admin_token))
    strict_plan_id = rpl_strict.json()["data"]["id"]

    return {
        "product_id": product_id,
        "variant_id": variant_id,
        "tax_id": tax_id,
        "plan_id": plan_id,
        "strict_plan_id": strict_plan_id,
    }


# ---------------------------------------------------------------------------
# Customers Tests
# ---------------------------------------------------------------------------

class TestCustomers:
    def test_customers_crud_admin(self, client):
        seed_user("admin@test.com", "admin", "Admin User")
        admin_token = get_token(client, "admin@test.com")

        uid, _ = seed_user("cust_new@test.com", "customer", "New Customer")
        # Admin creates customer profile
        rc = client.post("/api/v1/customers", json={
            "user_id": uid,
            "company_name": "Acme Pvt Ltd",
            "gstin": "29ABCDE1234F1Z5",
            "billing_address": "123 MG Road",
            "credit_limit": "50000.00",
        }, headers=auth(admin_token))
        assert rc.status_code == 201
        cid = rc.json()["data"]["id"]
        assert rc.json()["data"]["credit_limit"] == "50000.00"

        # List customers
        rl = client.get("/api/v1/customers?q=Acme", headers=auth(admin_token))
        assert rl.status_code == 200
        assert len(rl.json()["data"]) == 1

        # Get customer
        rg = client.get(f"/api/v1/customers/{cid}", headers=auth(admin_token))
        assert rg.status_code == 200
        assert rg.json()["data"]["company_name"] == "Acme Pvt Ltd"

        # Update customer (admin updates credit_limit)
        ru = client.put(f"/api/v1/customers/{cid}", json={
            "credit_limit": "75000.00"
        }, headers=auth(admin_token))
        assert ru.status_code == 200
        assert ru.json()["data"]["credit_limit"] == "75000.00"

    def test_customer_role_isolation_and_permissions(self, client):
        seed_user("admin@test.com", "admin", "Admin User")
        admin_token = get_token(client, "admin@test.com")

        u1_id, _ = seed_user("c1@test.com", "customer", "Cust 1")
        u2_id, _ = seed_user("c2@test.com", "customer", "Cust 2")

        c1_token = get_token(client, "c1@test.com")
        c2_token = get_token(client, "c2@test.com")

        # Create customer profile for c1
        r1 = client.post("/api/v1/customers", json={"user_id": u1_id, "company_name": "C1 Co"}, headers=auth(admin_token))
        c1_id = r1.json()["data"]["id"]

        # Create customer profile for c2
        r2 = client.post("/api/v1/customers", json={"user_id": u2_id, "company_name": "C2 Co"}, headers=auth(admin_token))
        c2_id = r2.json()["data"]["id"]

        # Customer role cannot list all customers (403)
        assert client.get("/api/v1/customers", headers=auth(c1_token)).status_code == 403

        # Customer 1 can get own profile
        assert client.get(f"/api/v1/customers/{c1_id}", headers=auth(c1_token)).status_code == 200

        # Customer 1 accessing Customer 2's profile gets 403
        assert client.get(f"/api/v1/customers/{c2_id}", headers=auth(c1_token)).status_code == 403

        # Customer 1 updating own profile: can update billing_address
        ru = client.put(f"/api/v1/customers/{c1_id}", json={
            "billing_address": "New Address",
            "credit_limit": "999999.00",  # should be ignored for customer role
        }, headers=auth(c1_token))
        assert ru.status_code == 200
        assert ru.json()["data"]["billing_address"] == "New Address"
        assert ru.json()["data"]["credit_limit"] != "999999.00"

        # Customer 1 updating Customer 2's profile gets 403
        ru2 = client.put(f"/api/v1/customers/{c2_id}", json={"billing_address": "Hack"}, headers=auth(c1_token))
        assert ru2.status_code == 403


# ---------------------------------------------------------------------------
# Quotation Templates Tests
# ---------------------------------------------------------------------------

class TestQuotationTemplates:
    def test_templates_crud(self, client):
        seed_user("admin@test.com", "admin", "Admin User")
        admin_token = get_token(client, "admin@test.com")
        catalog = setup_catalog(client, admin_token)

        # Create template with lines and validity_days
        r = client.post("/api/v1/quotation-templates", json={
            "name": "Standard Template",
            "validity_days": 45,
            "notes": "Sample template",
            "lines": [
                {
                    "product_variant_id": catalog["variant_id"],
                    "description": "Variant Line",
                    "quantity": "5.00",
                    "unit_price": "3560.00",
                    "discount": "100.00",
                    "tax_rule_id": catalog["tax_id"],
                }
            ],
        }, headers=auth(admin_token))
        assert r.status_code == 201
        data = r.json()["data"]
        assert data["name"] == "Standard Template"
        assert data["validity_days"] == 45
        assert len(data["lines"]) == 1
        # line_total = (3560 * 5) - 100 = 17700.00
        assert data["lines"][0]["line_total"] == "17700.00"
        tmpl_id = data["id"]

        # Get template
        rg = client.get(f"/api/v1/quotation-templates/{tmpl_id}", headers=auth(admin_token))
        assert rg.status_code == 200
        assert rg.json()["data"]["validity_days"] == 45

        # Update template
        ru = client.put(f"/api/v1/quotation-templates/{tmpl_id}", json={
            "validity_days": 60,
        }, headers=auth(admin_token))
        assert ru.status_code == 200
        assert ru.json()["data"]["validity_days"] == 60

        # Delete template
        rd = client.delete(f"/api/v1/quotation-templates/{tmpl_id}", headers=auth(admin_token))
        assert rd.status_code == 200
        assert client.get(f"/api/v1/quotation-templates/{tmpl_id}", headers=auth(admin_token)).status_code == 404


# ---------------------------------------------------------------------------
# Subscription Creation & Validation Tests
# ---------------------------------------------------------------------------

class TestSubscriptionsCreation:
    def test_invalid_quantity_enforces_plan_min_quantity(self, client):
        seed_user("admin@test.com", "admin", "Admin User")
        admin_token = get_token(client, "admin@test.com")
        catalog = setup_catalog(client, admin_token)

        uid, _ = seed_user("cust@test.com", "customer", "Cust")
        rc = client.post("/api/v1/customers", json={"user_id": uid}, headers=auth(admin_token))
        cust_id = rc.json()["data"]["id"]

        # Plan min_quantity is 2. Passing 1 should return 422
        r = client.post("/api/v1/subscriptions", json={
            "customer_id": cust_id,
            "plan_id": catalog["plan_id"],
            "start_date": str(date.today()),
            "lines": [
                {
                    "product_variant_id": catalog["variant_id"],
                    "quantity": 1,
                }
            ],
        }, headers=auth(admin_token))
        assert r.status_code == 422
        assert r.json()["error"]["code"] == "VALIDATION_ERROR"

    def test_plan_unavailable_on_start_date(self, client):
        seed_user("admin@test.com", "admin", "Admin User")
        admin_token = get_token(client, "admin@test.com")
        catalog = setup_catalog(client, admin_token)

        # Create plan available only in 2027
        rp = client.post("/api/v1/plans", json={
            "name": "Future Plan",
            "product_id": catalog["product_id"],
            "price": "1000.00",
            "billing_frequency": "monthly",
            "min_quantity": 1,
            "available_from": "2027-01-01",
        }, headers=auth(admin_token))
        future_plan_id = rp.json()["data"]["id"]

        uid, _ = seed_user("c@test.com", "customer", "Cust")
        rc = client.post("/api/v1/customers", json={"user_id": uid}, headers=auth(admin_token))
        cust_id = rc.json()["data"]["id"]

        # Try to subscribe starting today
        r = client.post("/api/v1/subscriptions", json={
            "customer_id": cust_id,
            "plan_id": future_plan_id,
            "start_date": str(date.today()),
            "lines": [{"quantity": 1}],
        }, headers=auth(admin_token))
        assert r.status_code == 400
        assert r.json()["error"]["code"] == "BUSINESS_RULE"

    def test_expiry_before_start_date_returns_422(self, client):
        seed_user("admin@test.com", "admin", "Admin User")
        admin_token = get_token(client, "admin@test.com")
        catalog = setup_catalog(client, admin_token)

        uid, _ = seed_user("c@test.com", "customer", "Cust")
        rc = client.post("/api/v1/customers", json={"user_id": uid}, headers=auth(admin_token))
        cust_id = rc.json()["data"]["id"]

        r = client.post("/api/v1/subscriptions", json={
            "customer_id": cust_id,
            "plan_id": catalog["plan_id"],
            "start_date": "2026-06-01",
            "expiry_date": "2026-05-01",
            "lines": [{"quantity": 2}],
        }, headers=auth(admin_token))
        assert r.status_code == 422

    def test_create_subscription_generates_sub_number_and_price_snapshot(self, client):
        seed_user("admin@test.com", "admin", "Admin User")
        admin_token = get_token(client, "admin@test.com")
        catalog = setup_catalog(client, admin_token)

        uid, _ = seed_user("c@test.com", "customer", "Cust")
        rc = client.post("/api/v1/customers", json={"user_id": uid}, headers=auth(admin_token))
        cust_id = rc.json()["data"]["id"]

        # Plan price is 3000.00, Variant extra_price is 560.00 -> unit_price should snapshot to 3560.00
        # Tax is GST 18%
        r = client.post("/api/v1/subscriptions", json={
            "customer_id": cust_id,
            "plan_id": catalog["plan_id"],
            "product_variant_id": catalog["variant_id"],
            "start_date": "2026-11-01",
            "expiry_date": "2027-10-31",
            "lines": [
                {
                    "product_variant_id": catalog["variant_id"],
                    "quantity": 5,
                    "tax_rule_id": catalog["tax_id"],
                }
            ],
        }, headers=auth(admin_token))
        assert r.status_code == 201
        data = r.json()["data"]

        # Unique number format
        year = date.today().year
        assert data["subscription_number"].startswith(f"SUB-{year}-")

        # Snapshot unit_price = 3000 + 560 = 3560.00
        line = data["lines"][0]
        assert line["unit_price"] == "3560.00"
        assert line["quantity"] == "5.00"
        # line_total = 5 * 3560.00 = 17800.00
        assert line["line_total"] == "17800.00"

        # Totals from pricing.py
        # subtotal = 17800.00
        # tax = 17800 * 0.18 = 3204.00
        # total = 17800 + 3204 = 21004.00
        assert data["subtotal"] == "17800.00"
        assert data["tax_amount"] == "3204.00"
        assert data["total"] == "21004.00"

    def test_create_subscription_from_template(self, client):
        seed_user("admin@test.com", "admin", "Admin User")
        admin_token = get_token(client, "admin@test.com")
        catalog = setup_catalog(client, admin_token)

        uid, _ = seed_user("c@test.com", "customer", "Cust")
        rc = client.post("/api/v1/customers", json={"user_id": uid}, headers=auth(admin_token))
        cust_id = rc.json()["data"]["id"]

        # Create template with validity_days = 20
        rt = client.post("/api/v1/quotation-templates", json={
            "name": "Quick Quotation",
            "validity_days": 20,
            "lines": [
                {
                    "product_variant_id": catalog["variant_id"],
                    "quantity": 2,
                    "unit_price": "3560.00",
                    "tax_rule_id": catalog["tax_id"],
                }
            ],
        }, headers=auth(admin_token))
        tmpl_id = rt.json()["data"]["id"]

        # Create subscription from template
        r = client.post("/api/v1/subscriptions/from-template", json={
            "template_id": tmpl_id,
            "customer_id": cust_id,
            "plan_id": catalog["plan_id"],
            "start_date": str(date.today()),
        }, headers=auth(admin_token))
        assert r.status_code == 201
        data = r.json()["data"]

        expected_valid_until = str(date.today() + timedelta(days=20))
        assert data["quotation_valid_until"] == expected_valid_until
        assert data["status"] == "draft"
        assert len(data["lines"]) == 1
        assert data["lines"][0]["unit_price"] == "3560.00"


# ---------------------------------------------------------------------------
# Subscription Lifecycle & Guards Tests
# ---------------------------------------------------------------------------

class TestSubscriptionLifecycle:
    def _create_sub(self, client, admin_token, plan_id, start_date="2026-11-01", expiry_date="2027-10-31") -> int:
        unique_email = f"u_{plan_id}_{uuid.uuid4().hex[:6]}@test.com"
        uid, _ = seed_user(unique_email, "customer", "Cust")
        rc = client.post("/api/v1/customers", json={"user_id": uid}, headers=auth(admin_token))
        cust_id = rc.json()["data"]["id"]

        r = client.post("/api/v1/subscriptions", json={
            "customer_id": cust_id,
            "plan_id": plan_id,
            "start_date": start_date,
            "expiry_date": expiry_date,
            "lines": [{"quantity": 2}],
        }, headers=auth(admin_token))
        return r.json()["data"]["id"]

    def test_lifecycle_happy_path(self, client):
        seed_user("admin@test.com", "admin", "Admin User")
        admin_token = get_token(client, "admin@test.com")
        catalog = setup_catalog(client, admin_token)
        sub_id = self._create_sub(client, admin_token, catalog["plan_id"])

        # 1. draft -> send-quotation -> quotation
        r1 = client.post(f"/api/v1/subscriptions/{sub_id}/send-quotation", headers=auth(admin_token))
        assert r1.status_code == 200
        assert r1.json()["data"]["status"] == "quotation"

        # 2. quotation -> confirm -> confirmed
        r2 = client.post(f"/api/v1/subscriptions/{sub_id}/confirm", headers=auth(admin_token))
        assert r2.status_code == 200
        assert r2.json()["data"]["status"] == "confirmed"

        # 3. confirmed -> activate -> active (sets next_billing_date = start_date)
        r3 = client.post(f"/api/v1/subscriptions/{sub_id}/activate", headers=auth(admin_token))
        assert r3.status_code == 200
        assert r3.json()["data"]["status"] == "active"
        assert r3.json()["data"]["next_billing_date"] == "2026-11-01"

        # 4. active -> pause -> paused
        r4 = client.post(f"/api/v1/subscriptions/{sub_id}/pause", headers=auth(admin_token))
        assert r4.status_code == 200
        assert r4.json()["data"]["status"] == "paused"

        # 5. paused -> resume -> active
        r5 = client.post(f"/api/v1/subscriptions/{sub_id}/resume", headers=auth(admin_token))
        assert r5.status_code == 200
        assert r5.json()["data"]["status"] == "active"

        # 6. active -> renew -> active (extends expiry_date)
        r6 = client.post(f"/api/v1/subscriptions/{sub_id}/renew", headers=auth(admin_token))
        assert r6.status_code == 200
        assert r6.json()["data"]["status"] == "active"
        # renewed by 1 month from 2027-10-31 -> 2027-11-30
        assert r6.json()["data"]["expiry_date"] == "2027-11-30"

        # 7. active -> close -> closed (sets cancelled_at)
        r7 = client.post(f"/api/v1/subscriptions/{sub_id}/close", headers=auth(admin_token))
        assert r7.status_code == 200
        assert r7.json()["data"]["status"] == "closed"
        assert r7.json()["data"]["cancelled_at"] is not None

    def test_illegal_transitions_return_400(self, client):
        seed_user("admin@test.com", "admin", "Admin User")
        admin_token = get_token(client, "admin@test.com")
        catalog = setup_catalog(client, admin_token)
        sub_id = self._create_sub(client, admin_token, catalog["plan_id"])

        # In draft status: cannot activate directly
        r = client.post(f"/api/v1/subscriptions/{sub_id}/activate", headers=auth(admin_token))
        assert r.status_code == 400
        assert r.json()["error"]["code"] == "BUSINESS_RULE"

        # In draft status: cannot pause
        r_pause = client.post(f"/api/v1/subscriptions/{sub_id}/pause", headers=auth(admin_token))
        assert r_pause.status_code == 400

        # Close subscription then try closing again
        client.post(f"/api/v1/subscriptions/{sub_id}/send-quotation", headers=auth(admin_token))
        client.post(f"/api/v1/subscriptions/{sub_id}/confirm", headers=auth(admin_token))
        client.post(f"/api/v1/subscriptions/{sub_id}/activate", headers=auth(admin_token))
        client.post(f"/api/v1/subscriptions/{sub_id}/close", headers=auth(admin_token))

        r_close_again = client.post(f"/api/v1/subscriptions/{sub_id}/close", headers=auth(admin_token))
        assert r_close_again.status_code == 400

    def test_pause_disallowed_by_plan(self, client):
        seed_user("admin@test.com", "admin", "Admin User")
        admin_token = get_token(client, "admin@test.com")
        catalog = setup_catalog(client, admin_token)

        # Create sub on strict_plan (allow_pause = False)
        sub_id = self._create_sub(client, admin_token, catalog["strict_plan_id"])
        client.post(f"/api/v1/subscriptions/{sub_id}/send-quotation", headers=auth(admin_token))
        client.post(f"/api/v1/subscriptions/{sub_id}/confirm", headers=auth(admin_token))
        client.post(f"/api/v1/subscriptions/{sub_id}/activate", headers=auth(admin_token))

        # Pause should fail with 400 BUSINESS_RULE
        r = client.post(f"/api/v1/subscriptions/{sub_id}/pause", headers=auth(admin_token))
        assert r.status_code == 400
        assert r.json()["error"]["code"] == "BUSINESS_RULE"

    def test_renewal_and_early_close_guards(self, client):
        seed_user("admin@test.com", "admin", "Admin User")
        admin_token = get_token(client, "admin@test.com")
        catalog = setup_catalog(client, admin_token)

        sub_id = self._create_sub(
            client, admin_token, catalog["strict_plan_id"],
            start_date="2026-11-01", expiry_date="2030-11-01"
        )
        client.post(f"/api/v1/subscriptions/{sub_id}/send-quotation", headers=auth(admin_token))
        client.post(f"/api/v1/subscriptions/{sub_id}/confirm", headers=auth(admin_token))
        client.post(f"/api/v1/subscriptions/{sub_id}/activate", headers=auth(admin_token))

        # Renewal disallowed
        r_renew = client.post(f"/api/v1/subscriptions/{sub_id}/renew", headers=auth(admin_token))
        assert r_renew.status_code == 400
        assert r_renew.json()["error"]["code"] == "BUSINESS_RULE"

        # Early close disallowed before expiry
        r_close = client.post(f"/api/v1/subscriptions/{sub_id}/close", headers=auth(admin_token))
        assert r_close.status_code == 400
        assert r_close.json()["error"]["code"] == "BUSINESS_RULE"


# ---------------------------------------------------------------------------
# Customer Role Scoping & Isolation Tests
# ---------------------------------------------------------------------------

class TestSubscriptionCustomerIsolation:
    def test_customer_isolation(self, client):
        seed_user("admin@test.com", "admin", "Admin User")
        admin_token = get_token(client, "admin@test.com")
        catalog = setup_catalog(client, admin_token)

        # Create 2 customers
        u1_id, _ = seed_user("user1@test.com", "customer", "User One")
        u2_id, _ = seed_user("user2@test.com", "customer", "User Two")

        r1 = client.post("/api/v1/customers", json={"user_id": u1_id, "company_name": "Company One"}, headers=auth(admin_token))
        cust1_id = r1.json()["data"]["id"]

        r2 = client.post("/api/v1/customers", json={"user_id": u2_id, "company_name": "Company Two"}, headers=auth(admin_token))
        cust2_id = r2.json()["data"]["id"]

        t1 = get_token(client, "user1@test.com")
        t2 = get_token(client, "user2@test.com")

        # Sub 1 for Customer 1
        s1 = client.post("/api/v1/subscriptions", json={
            "customer_id": cust1_id,
            "plan_id": catalog["plan_id"],
            "start_date": "2026-11-01",
            "lines": [{"quantity": 2}],
        }, headers=auth(admin_token)).json()["data"]["id"]

        # Sub 2 for Customer 2
        s2 = client.post("/api/v1/subscriptions", json={
            "customer_id": cust2_id,
            "plan_id": catalog["plan_id"],
            "start_date": "2026-11-01",
            "lines": [{"quantity": 2}],
        }, headers=auth(admin_token)).json()["data"]["id"]

        # 1. Customer 1 lists subscriptions: returns ONLY Sub 1
        r_list1 = client.get("/api/v1/subscriptions", headers=auth(t1))
        assert r_list1.status_code == 200
        ids1 = [s["id"] for s in r_list1.json()["data"]]
        assert s1 in ids1
        assert s2 not in ids1

        # 2. Customer 1 attempts to get Sub 2: returns 404 NOT_FOUND
        r_get_other = client.get(f"/api/v1/subscriptions/{s2}", headers=auth(t1))
        assert r_get_other.status_code == 404
        assert r_get_other.json()["error"]["code"] == "NOT_FOUND"

        # 3. Customer 1 gets Sub 1: 200 OK
        r_get_own = client.get(f"/api/v1/subscriptions/{s1}", headers=auth(t1))
        assert r_get_own.status_code == 200
        assert r_get_own.json()["data"]["id"] == s1

