"""
Tests for catalog APIs: products, variants, plans, tax rules, pricing.
Run from backend/ with: pytest tests/test_catalog.py -v
"""
from __future__ import annotations

import pytest
from decimal import Decimal
from fastapi.testclient import TestClient

from app.main import app
# DB setup (engine, override, table reset) lives in tests/conftest.py
from tests.conftest import TestingSessionLocal as TestingSession


@pytest.fixture
def client():
    return TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# Helper: seed admin and get token
# ---------------------------------------------------------------------------

VALID_PASSWORD = "Strong@Pass1"


def seed_admin(client: TestClient) -> str:
    from app.core.security import hash_password
    from app.models.models import User, RoleEnum
    db = TestingSession()
    try:
        admin = User(
            email="admin@test.com",
            hashed_password=hash_password(VALID_PASSWORD),
            full_name="Admin",
            role=RoleEnum.admin,
            is_active=True,
        )
        db.add(admin)
        db.commit()
    finally:
        db.close()
    r = client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": VALID_PASSWORD})
    return r.json()["data"]["access_token"]


def seed_customer(client: TestClient) -> str:
    """Register a customer user and return their token."""
    client.post("/api/v1/auth/register", json={
        "email": "cust@test.com", "password": VALID_PASSWORD, "full_name": "Customer"
    })
    r = client.post("/api/v1/auth/login", json={"email": "cust@test.com", "password": VALID_PASSWORD})
    return r.json()["data"]["access_token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Product tests
# ---------------------------------------------------------------------------

class TestProducts:
    def test_create_product_admin(self, client):
        token = seed_admin(client)
        r = client.post("/api/v1/products", json={
            "name": "ERP Software",
            "product_type": "software",
            "sales_price": "2000.00",
            "cost_price": "0.00",
            "notes": "Main license",
            "hsn_code": "998314",
        }, headers=auth(token))
        assert r.status_code == 201
        data = r.json()["data"]
        assert data["name"] == "ERP Software"
        assert data["product_type"] == "software"
        assert data["sales_price"] == "2000.00"
        assert data["cost_price"] == "0.00"
        assert data["notes"] == "Main license"
        assert data["is_active"] is True
        assert data["variants"] == []

    def test_create_product_defaults(self, client):
        """product_type defaults to software, prices default to 0.00."""
        token = seed_admin(client)
        r = client.post("/api/v1/products", json={"name": "Simple Product"}, headers=auth(token))
        assert r.status_code == 201
        data = r.json()["data"]
        assert data["product_type"] == "software"
        assert data["sales_price"] == "0.00"
        assert data["cost_price"] == "0.00"

    def test_create_product_non_admin_returns_403(self, client):
        token = seed_customer(client)
        r = client.post("/api/v1/products", json={"name": "X"}, headers=auth(token))
        assert r.status_code == 403
        assert r.json()["error"]["code"] == "FORBIDDEN"

    def test_invalid_product_type_returns_422(self, client):
        token = seed_admin(client)
        r = client.post("/api/v1/products", json={"name": "X", "product_type": "invalid_type"}, headers=auth(token))
        assert r.status_code == 422
        assert r.json()["error"]["code"] == "VALIDATION_ERROR"

    def test_negative_sales_price_returns_422(self, client):
        token = seed_admin(client)
        r = client.post("/api/v1/products", json={"name": "X", "sales_price": "-10.00"}, headers=auth(token))
        assert r.status_code == 422

    def test_list_products_customer_can_read(self, client):
        cust_token = seed_customer(client)
        r = client.get("/api/v1/products", headers=auth(cust_token))
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_list_products_pagination(self, client):
        admin_token = seed_admin(client)
        for i in range(5):
            client.post("/api/v1/products", json={"name": f"Product {i+1}"}, headers=auth(admin_token))

        r = client.get("/api/v1/products?page=2&page_size=2", headers=auth(admin_token))
        assert r.status_code == 200
        res = r.json()
        assert len(res["data"]) == 2
        assert res["meta"]["page"] == 2
        assert res["meta"]["page_size"] == 2
        assert res["meta"]["total"] == 5

    def test_get_product_not_found(self, client):
        token = seed_admin(client)
        r = client.get("/api/v1/products/99999", headers=auth(token))
        assert r.status_code == 404
        assert r.json()["error"]["code"] == "NOT_FOUND"

    def test_update_product(self, client):
        token = seed_admin(client)
        rp = client.post("/api/v1/products", json={"name": "Old Name"}, headers=auth(token))
        pid = rp.json()["data"]["id"]

        r = client.put(f"/api/v1/products/{pid}", json={"name": "New Name", "sales_price": "2500.00"}, headers=auth(token))
        assert r.status_code == 200
        assert r.json()["data"]["name"] == "New Name"
        assert r.json()["data"]["sales_price"] == "2500.00"

    def test_update_product_non_admin_returns_403(self, client):
        admin_token = seed_admin(client)
        cust_token = seed_customer(client)
        rp = client.post("/api/v1/products", json={"name": "P"}, headers=auth(admin_token))
        pid = rp.json()["data"]["id"]
        r = client.put(f"/api/v1/products/{pid}", json={"name": "Hack"}, headers=auth(cust_token))
        assert r.status_code == 403
        assert r.json()["error"]["code"] == "FORBIDDEN"

    def test_soft_delete_product(self, client):
        token = seed_admin(client)
        rp = client.post("/api/v1/products", json={"name": "To Delete"}, headers=auth(token))
        pid = rp.json()["data"]["id"]

        r = client.delete(f"/api/v1/products/{pid}", headers=auth(token))
        assert r.status_code == 200
        assert r.json()["data"]["message"] == "Product deactivated."

        rg = client.get(f"/api/v1/products/{pid}", headers=auth(token))
        assert rg.json()["data"]["is_active"] is False

    def test_delete_product_non_admin_returns_403(self, client):
        admin_token = seed_admin(client)
        cust_token = seed_customer(client)
        rp = client.post("/api/v1/products", json={"name": "P"}, headers=auth(admin_token))
        pid = rp.json()["data"]["id"]
        r = client.delete(f"/api/v1/products/{pid}", headers=auth(cust_token))
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# Variant tests
# ---------------------------------------------------------------------------

class TestVariants:
    def _create_product(self, client, token, sales_price="2000.00") -> int:
        r = client.post("/api/v1/products", json={
            "name": "Base Product",
            "product_type": "software",
            "sales_price": sales_price,
        }, headers=auth(token))
        return r.json()["data"]["id"]

    def test_create_variant(self, client):
        token = seed_admin(client)
        pid = self._create_product(client, token)
        r = client.post(f"/api/v1/products/{pid}/variants", json={
            "attribute": "Edition",
            "value": "Standard",
            "extra_price": "0.00",
        }, headers=auth(token))
        assert r.status_code == 201
        data = r.json()["data"]
        assert data["attribute"] == "Edition"
        assert data["value"] == "Standard"
        assert data["extra_price"] == "0.00"

    def test_variant_extra_price_is_money_string(self, client):
        token = seed_admin(client)
        pid = self._create_product(client, token)
        r = client.post(f"/api/v1/products/{pid}/variants", json={
            "attribute": "Brand",
            "value": "Odoo",
            "extra_price": "560.00",
            "sku": "ODOO-001",
        }, headers=auth(token))
        assert r.json()["data"]["extra_price"] == "560.00"

    def test_variant_without_sku_allowed(self, client):
        """SKU is optional; no sku = accepted."""
        token = seed_admin(client)
        pid = self._create_product(client, token)
        r = client.post(f"/api/v1/products/{pid}/variants", json={
            "attribute": "Color", "value": "Blue"
        }, headers=auth(token))
        assert r.status_code == 201
        assert r.json()["data"]["sku"] is None

    def test_duplicate_sku_returns_409(self, client):
        token = seed_admin(client)
        pid = self._create_product(client, token)
        payload = {"attribute": "Brand", "value": "Odoo", "extra_price": "0.00", "sku": "DUP-SKU"}
        client.post(f"/api/v1/products/{pid}/variants", json=payload, headers=auth(token))
        r = client.post(f"/api/v1/products/{pid}/variants", json=payload, headers=auth(token))
        assert r.status_code == 409

    def test_soft_delete_variant(self, client):
        token = seed_admin(client)
        pid = self._create_product(client, token)
        rv = client.post(f"/api/v1/products/{pid}/variants", json={
            "attribute": "Brand", "value": "SAP", "extra_price": "0"
        }, headers=auth(token))
        vid = rv.json()["data"]["id"]
        r = client.delete(f"/api/v1/variants/{vid}", headers=auth(token))
        assert r.status_code == 200
        assert r.json()["data"]["message"] == "Variant deactivated."

    def test_non_admin_cannot_create_variant(self, client):
        admin_token = seed_admin(client)
        cust_token = seed_customer(client)
        pid = self._create_product(client, admin_token)
        r = client.post(f"/api/v1/products/{pid}/variants", json={
            "attribute": "Brand", "value": "Test"
        }, headers=auth(cust_token))
        assert r.status_code == 403

    def test_non_admin_cannot_update_variant(self, client):
        admin_token = seed_admin(client)
        cust_token = seed_customer(client)
        pid = self._create_product(client, admin_token)
        rv = client.post(f"/api/v1/products/{pid}/variants", json={
            "attribute": "Brand", "value": "Test"
        }, headers=auth(admin_token))
        vid = rv.json()["data"]["id"]
        r = client.put(f"/api/v1/variants/{vid}", json={"value": "Updated"}, headers=auth(cust_token))
        assert r.status_code == 403

    def test_non_admin_cannot_delete_variant(self, client):
        admin_token = seed_admin(client)
        cust_token = seed_customer(client)
        pid = self._create_product(client, admin_token)
        rv = client.post(f"/api/v1/products/{pid}/variants", json={
            "attribute": "Brand", "value": "Test"
        }, headers=auth(admin_token))
        vid = rv.json()["data"]["id"]
        r = client.delete(f"/api/v1/variants/{vid}", headers=auth(cust_token))
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# Pricing tests
# ---------------------------------------------------------------------------

class TestPricing:
    def test_unit_price_base_plus_extra(self):
        """pricing service: 2000.00 + 560.00 = 2560.00 (Decimal, ROUND_HALF_UP)."""
        from app.services.pricing import quantize_money, money_str
        result = quantize_money(Decimal("2000.00") + Decimal("560.00"))
        assert result == Decimal("2560.00")
        assert money_str(result) == "2560.00"

    def test_pricing_service_calculate_product_price(self):
        from app.models.models import Product, ProductVariant
        from app.services.pricing import calculate_product_price
        product = Product(name="P", sales_price=Decimal("2000.00"))
        variant = ProductVariant(attribute="Brand", value="Odoo", extra_price=Decimal("560.00"))
        base, extra, final = calculate_product_price(product, variant)
        assert base == Decimal("2000.00")
        assert extra == Decimal("560.00")
        assert final == Decimal("2560.00")

    def test_price_endpoint_no_variant(self, client):
        """GET /products/{id}/price without variant returns product sales_price."""
        token = seed_admin(client)
        rp = client.post("/api/v1/products", json={
            "name": "ERP", "sales_price": "2000.00"
        }, headers=auth(token))
        pid = rp.json()["data"]["id"]

        r = client.get(f"/api/v1/products/{pid}/price", headers=auth(token))
        assert r.status_code == 200
        d = r.json()["data"]
        assert d["sales_price"] == "2000.00"
        assert d["extra_price"] == "0.00"
        assert d["final_price"] == "2000.00"

    def test_price_endpoint_with_variant(self, client):
        """GET /products/{id}/price?variant_id=  → sales_price + extra_price = 2560.00."""
        token = seed_admin(client)
        rp = client.post("/api/v1/products", json={
            "name": "ERP", "sales_price": "2000.00"
        }, headers=auth(token))
        pid = rp.json()["data"]["id"]
        rv = client.post(f"/api/v1/products/{pid}/variants", json={
            "attribute": "Brand", "value": "Odoo", "extra_price": "560.00", "sku": "ODOO-P"
        }, headers=auth(token))
        vid = rv.json()["data"]["id"]

        r = client.get(f"/api/v1/products/{pid}/price?variant_id={vid}", headers=auth(token))
        assert r.status_code == 200
        d = r.json()["data"]
        assert d["sales_price"] == "2000.00"
        assert d["extra_price"] == "560.00"
        assert d["final_price"] == "2560.00"

    def test_price_endpoint_wrong_variant_product(self, client):
        """Variant from a different product should return 400 BUSINESS_RULE."""
        token = seed_admin(client)
        rp1 = client.post("/api/v1/products", json={"name": "P1", "sales_price": "1000.00"}, headers=auth(token))
        pid1 = rp1.json()["data"]["id"]
        rp2 = client.post("/api/v1/products", json={"name": "P2", "sales_price": "500.00"}, headers=auth(token))
        pid2 = rp2.json()["data"]["id"]

        rv = client.post(f"/api/v1/products/{pid2}/variants", json={
            "attribute": "Brand", "value": "Other", "extra_price": "100"
        }, headers=auth(token))
        vid = rv.json()["data"]["id"]

        r = client.get(f"/api/v1/products/{pid1}/price?variant_id={vid}", headers=auth(token))
        assert r.status_code == 400
        assert r.json()["error"]["code"] == "BUSINESS_RULE"


# ---------------------------------------------------------------------------
# Plan tests
# ---------------------------------------------------------------------------

class TestPlans:
    def _create_product_and_plan(self, client, token, plan_overrides=None) -> tuple[int, int]:
        rp = client.post("/api/v1/products", json={"name": "Prod", "sales_price": "2000.00"}, headers=auth(token))
        pid = rp.json()["data"]["id"]
        payload = {
            "name": "Monthly Plan", "product_id": pid,
            "price": "2999.00", "billing_frequency": "monthly", "min_quantity": 1
        }
        if plan_overrides:
            payload.update(plan_overrides)
        rpl = client.post("/api/v1/plans", json=payload, headers=auth(token))
        return pid, rpl.json()["data"]["id"]

    def test_create_plan_admin(self, client):
        token = seed_admin(client)
        pid, plan_id = self._create_product_and_plan(client, token)
        assert plan_id > 0

    def test_plan_price_is_money_string(self, client):
        token = seed_admin(client)
        _, plan_id = self._create_product_and_plan(client, token)
        r = client.get(f"/api/v1/plans/{plan_id}", headers=auth(token))
        assert r.json()["data"]["price"] == "2999.00"

    def test_create_plan_non_admin_returns_403(self, client):
        admin = seed_admin(client)
        cust = seed_customer(client)
        rp = client.post("/api/v1/products", json={"name": "P"}, headers=auth(admin))
        pid = rp.json()["data"]["id"]
        r = client.post("/api/v1/plans", json={
            "name": "X", "product_id": pid, "price": "100",
            "billing_frequency": "monthly", "min_quantity": 1
        }, headers=auth(cust))
        assert r.status_code == 403

    def test_invalid_dates_available_until_before_from(self, client):
        token = seed_admin(client)
        rp = client.post("/api/v1/products", json={"name": "P"}, headers=auth(token))
        pid = rp.json()["data"]["id"]
        r = client.post("/api/v1/plans", json={
            "name": "Bad Dates", "product_id": pid,
            "price": "1000", "billing_frequency": "monthly", "min_quantity": 1,
            "available_from": "2027-01-01", "available_until": "2026-01-01"
        }, headers=auth(token))
        assert r.status_code == 422
        assert r.json()["error"]["code"] == "VALIDATION_ERROR"

    def test_valid_dates_available_until_equal_from(self, client):
        token = seed_admin(client)
        rp = client.post("/api/v1/products", json={"name": "P_dates"}, headers=auth(token))
        pid = rp.json()["data"]["id"]
        r = client.post("/api/v1/plans", json={
            "name": "Same Dates", "product_id": pid,
            "price": "1000", "billing_frequency": "monthly", "min_quantity": 1,
            "available_from": "2026-06-01", "available_until": "2026-06-01"
        }, headers=auth(token))
        assert r.status_code == 201

    def test_invalid_min_quantity(self, client):
        token = seed_admin(client)
        rp = client.post("/api/v1/products", json={"name": "P"}, headers=auth(token))
        pid = rp.json()["data"]["id"]
        r = client.post("/api/v1/plans", json={
            "name": "Bad Qty", "product_id": pid,
            "price": "1000", "billing_frequency": "monthly", "min_quantity": 0
        }, headers=auth(token))
        assert r.status_code == 422

    def test_create_plan_product_not_found(self, client):
        token = seed_admin(client)
        r = client.post("/api/v1/plans", json={
            "name": "X", "product_id": 9999,
            "price": "100", "billing_frequency": "monthly", "min_quantity": 1
        }, headers=auth(token))
        assert r.status_code == 404

    def test_soft_delete_plan(self, client):
        token = seed_admin(client)
        _, plan_id = self._create_product_and_plan(client, token)
        r = client.delete(f"/api/v1/plans/{plan_id}", headers=auth(token))
        assert r.status_code == 200
        assert r.json()["data"]["message"] == "Plan deactivated."

    def test_non_admin_cannot_update_plan(self, client):
        admin = seed_admin(client)
        cust = seed_customer(client)
        _, plan_id = self._create_product_and_plan(client, admin)
        r = client.put(f"/api/v1/plans/{plan_id}", json={"name": "Hacked"}, headers=auth(cust))
        assert r.status_code == 403

    def test_non_admin_cannot_delete_plan(self, client):
        admin = seed_admin(client)
        cust = seed_customer(client)
        _, plan_id = self._create_product_and_plan(client, admin)
        r = client.delete(f"/api/v1/plans/{plan_id}", headers=auth(cust))
        assert r.status_code == 403

    def test_list_plans_filter_by_frequency(self, client):
        token = seed_admin(client)
        rp = client.post("/api/v1/products", json={"name": "P"}, headers=auth(token))
        pid = rp.json()["data"]["id"]
        client.post("/api/v1/plans", json={
            "name": "M", "product_id": pid, "price": "100",
            "billing_frequency": "monthly", "min_quantity": 1
        }, headers=auth(token))
        client.post("/api/v1/plans", json={
            "name": "Y", "product_id": pid, "price": "1000",
            "billing_frequency": "yearly", "min_quantity": 1
        }, headers=auth(token))
        r = client.get("/api/v1/plans?billing_frequency=monthly", headers=auth(token))
        assert r.status_code == 200
        data = r.json()["data"]
        assert all(p["billing_frequency"] == "monthly" for p in data)

    def test_list_plans_pagination(self, client):
        token = seed_admin(client)
        rp = client.post("/api/v1/products", json={"name": "P_pages"}, headers=auth(token))
        pid = rp.json()["data"]["id"]
        for i in range(4):
            client.post("/api/v1/plans", json={
                "name": f"Plan {i}", "product_id": pid, "price": "100",
                "billing_frequency": "monthly", "min_quantity": 1
            }, headers=auth(token))
        r = client.get("/api/v1/plans?page=1&page_size=2", headers=auth(token))
        assert r.status_code == 200
        assert len(r.json()["data"]) == 2
        assert r.json()["meta"]["total"] == 4


# ---------------------------------------------------------------------------
# Tax rule tests
# ---------------------------------------------------------------------------

class TestTaxRules:
    def test_create_tax_rule(self, client):
        token = seed_admin(client)
        r = client.post("/api/v1/taxes", json={
            "name": "GST 18%", "rate_percent": "18.00", "is_default": True
        }, headers=auth(token))
        assert r.status_code == 201
        data = r.json()["data"]
        assert data["name"] == "GST 18%"
        assert data["rate_percent"] == "18.00"
        assert data["is_default"] is True
        assert data["is_active"] is True

    def test_create_tax_rule_rate_backward_compat(self, client):
        token = seed_admin(client)
        r = client.post("/api/v1/taxes", json={
            "name": "GST 12%", "rate": "12.00", "applies_to": "all"
        }, headers=auth(token))
        assert r.status_code == 201
        assert r.json()["data"]["rate_percent"] == "12.00"
        assert r.json()["data"]["rate"] == "12.00"

    def test_create_tax_hsn_required(self, client):
        token = seed_admin(client)
        r = client.post("/api/v1/taxes", json={
            "name": "HSN Tax", "rate_percent": "12.00", "applies_to": "hsn"
        }, headers=auth(token))
        assert r.status_code == 422

    def test_non_admin_cannot_create_tax(self, client):
        cust = seed_customer(client)
        r = client.post("/api/v1/taxes", json={
            "name": "X", "rate_percent": "5", "is_default": False
        }, headers=auth(cust))
        assert r.status_code == 403

    def test_non_admin_cannot_update_tax(self, client):
        admin = seed_admin(client)
        cust = seed_customer(client)
        rt = client.post("/api/v1/taxes", json={
            "name": "T", "rate_percent": "5"
        }, headers=auth(admin))
        tid = rt.json()["data"]["id"]
        r = client.put(f"/api/v1/taxes/{tid}", json={"name": "Hacked"}, headers=auth(cust))
        assert r.status_code == 403

    def test_non_admin_cannot_delete_tax(self, client):
        admin = seed_admin(client)
        cust = seed_customer(client)
        rt = client.post("/api/v1/taxes", json={
            "name": "T", "rate_percent": "5"
        }, headers=auth(admin))
        tid = rt.json()["data"]["id"]
        r = client.delete(f"/api/v1/taxes/{tid}", headers=auth(cust))
        assert r.status_code == 403

    def test_soft_delete_tax(self, client):
        token = seed_admin(client)
        r = client.post("/api/v1/taxes", json={
            "name": "GST 5%", "rate_percent": "5.00"
        }, headers=auth(token))
        tid = r.json()["data"]["id"]
        r2 = client.delete(f"/api/v1/taxes/{tid}", headers=auth(token))
        assert r2.status_code == 200
        assert r2.json()["data"]["message"] == "Tax rule deactivated."

    def test_list_taxes_pagination(self, client):
        token = seed_admin(client)
        for i in range(3):
            client.post("/api/v1/taxes", json={"name": f"Tax {i}", "rate_percent": "5.00"}, headers=auth(token))
        r = client.get("/api/v1/taxes?page=1&page_size=2", headers=auth(token))
        assert r.status_code == 200
        assert len(r.json()["data"]) == 2
        assert r.json()["meta"]["total"] == 3
