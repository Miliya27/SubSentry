"""
Tests for auth endpoints and RBAC.
Run from backend/ with: pytest tests/test_auth.py -v
"""
from __future__ import annotations

import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient

from app.main import app
# DB setup (engine, override, table reset) lives in tests/conftest.py
from tests.conftest import TestingSessionLocal


@pytest.fixture
def client():
    # raise_server_exceptions=False: let the app's exception handlers
    # return proper HTTP responses rather than bubbling up as test errors.
    return TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

VALID_PASSWORD = "Strong@Pass1"
ADMIN_EMAIL = "admin@test.com"
STAFF_EMAIL = "staff@test.com"
CUSTOMER_EMAIL = "cust@test.com"


def register_user(client, email=CUSTOMER_EMAIL, password=VALID_PASSWORD, full_name="Test User"):
    return client.post("/api/v1/auth/register", json={
        "email": email, "password": password, "full_name": full_name
    })


def login_user(client, email=CUSTOMER_EMAIL, password=VALID_PASSWORD):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def get_token(client, email=CUSTOMER_EMAIL, password=VALID_PASSWORD):
    register_user(client, email, password)
    r = login_user(client, email, password)
    return r.json()["data"]["access_token"]


def seed_admin(client):
    """Directly insert an admin user via the DB override."""
    from app.core.security import hash_password
    from app.models.models import User, RoleEnum
    db = TestingSessionLocal()
    try:
        admin = User(
            email=ADMIN_EMAIL,
            hashed_password=hash_password(VALID_PASSWORD),
            full_name="Admin",
            role=RoleEnum.admin,
            is_active=True,
        )
        db.add(admin)
        db.commit()
    finally:
        db.close()
    r = client.post("/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": VALID_PASSWORD})
    return r.json()["data"]["access_token"]


# ---------------------------------------------------------------------------
# Registration tests
# ---------------------------------------------------------------------------

class TestRegister:
    def test_valid_register_creates_user_and_customer(self, client):
        r = register_user(client)
        assert r.status_code == 201
        data = r.json()
        assert data["success"] is True
        assert data["data"]["email"] == CUSTOMER_EMAIL
        assert data["data"]["role"] == "customer"

    def test_duplicate_email_returns_409(self, client):
        register_user(client)
        r = register_user(client)
        assert r.status_code == 409
        assert r.json()["error"]["code"] == "CONFLICT"

    def test_weak_password_too_short_returns_422(self, client):
        r = register_user(client, password="Ab@1234")  # 7 chars
        assert r.status_code == 422

    def test_weak_password_no_uppercase(self, client):
        r = register_user(client, password="weak@pass1")
        assert r.status_code == 422

    def test_weak_password_no_lowercase(self, client):
        r = register_user(client, password="STRONG@PASS1")
        assert r.status_code == 422

    def test_weak_password_no_special_char(self, client):
        r = register_user(client, password="StrongPass1")
        assert r.status_code == 422

    def test_invalid_email_returns_422(self, client):
        r = client.post("/api/v1/auth/register", json={
            "email": "not-an-email", "password": VALID_PASSWORD, "full_name": "X"
        })
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# Login tests
# ---------------------------------------------------------------------------

class TestLogin:
    def test_valid_login_returns_token(self, client):
        register_user(client)
        r = login_user(client)
        assert r.status_code == 200
        data = r.json()["data"]
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_wrong_password_returns_401(self, client):
        register_user(client)
        r = login_user(client, password="WrongPass@99")
        assert r.status_code == 401
        assert r.json()["error"]["code"] == "UNAUTHENTICATED"

    def test_nonexistent_user_returns_401(self, client):
        r = login_user(client, email="nobody@nowhere.com")
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# GET /auth/me
# ---------------------------------------------------------------------------

class TestMe:
    def test_me_returns_user_profile(self, client):
        token = get_token(client)
        r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert r.json()["data"]["email"] == CUSTOMER_EMAIL

    def test_me_without_token_returns_401(self, client):
        r = client.get("/api/v1/auth/me")
        assert r.status_code == 401

    def test_me_with_bad_token_returns_401(self, client):
        r = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer bad.token.here"})
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Staff creation RBAC tests
# ---------------------------------------------------------------------------

class TestCreateStaff:
    def test_admin_can_create_staff(self, client):
        admin_token = seed_admin(client)
        r = client.post(
            "/api/v1/users/staff",
            json={"email": STAFF_EMAIL, "password": VALID_PASSWORD, "full_name": "Staff"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r.status_code == 201
        assert r.json()["data"]["role"] == "staff"

    def test_staff_cannot_create_staff(self, client):
        admin_token = seed_admin(client)
        # Create a staff user first
        client.post(
            "/api/v1/users/staff",
            json={"email": STAFF_EMAIL, "password": VALID_PASSWORD, "full_name": "Staff"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        r_login = client.post("/api/v1/auth/login", json={"email": STAFF_EMAIL, "password": VALID_PASSWORD})
        staff_token = r_login.json()["data"]["access_token"]

        r = client.post(
            "/api/v1/users/staff",
            json={"email": "another@staff.com", "password": VALID_PASSWORD, "full_name": "Another"},
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        assert r.status_code == 403
        assert r.json()["error"]["code"] == "FORBIDDEN"

    def test_customer_cannot_create_staff(self, client):
        token = get_token(client)
        r = client.post(
            "/api/v1/users/staff",
            json={"email": STAFF_EMAIL, "password": VALID_PASSWORD, "full_name": "Staff"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 403

    def test_duplicate_staff_email_returns_409(self, client):
        admin_token = seed_admin(client)
        payload = {"email": STAFF_EMAIL, "password": VALID_PASSWORD, "full_name": "Staff"}
        client.post("/api/v1/users/staff", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
        r = client.post("/api/v1/users/staff", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 409


# ---------------------------------------------------------------------------
# Password reset tests
# ---------------------------------------------------------------------------

class TestPasswordReset:
    def test_forgot_password_always_200(self, client):
        """Same 200 response whether email exists or not."""
        r1 = client.post("/api/v1/auth/forgot-password", json={"email": "nobody@ghost.com"})
        r2 = client.post("/api/v1/auth/forgot-password", json={"email": CUSTOMER_EMAIL})
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r1.json()["data"]["message"] == r2.json()["data"]["message"]

    def test_reset_with_invalid_token_returns_404(self, client):
        r = client.post("/api/v1/auth/reset-password", json={
            "token": "fakefakefakefake",
            "new_password": "NewPass@999",
        })
        assert r.status_code == 404
        assert r.json()["error"]["code"] == "NOT_FOUND"

    def test_reset_token_expiry(self, client):
        """Manually insert an expired token and verify 400 BUSINESS_RULE."""
        register_user(client)
        from app.core.security import hash_reset_token
        from app.models.models import PasswordResetToken, User
        db = TestingSessionLocal()
        try:
            user = db.query(User).filter(User.email == CUSTOMER_EMAIL).first()
            past = datetime.now(tz=timezone.utc) - timedelta(hours=1)
            raw = "expiredtokenvalue12345678901234"
            record = PasswordResetToken(
                user_id=user.id,
                token=hash_reset_token(raw),
                expires_at=past,
                used=False,
            )
            db.add(record)
            db.commit()
        finally:
            db.close()

        r = client.post("/api/v1/auth/reset-password", json={
            "token": raw,
            "new_password": "NewPass@999",
        })
        assert r.status_code == 400
        assert r.json()["error"]["code"] == "BUSINESS_RULE"

    def test_reset_token_reuse(self, client):
        """After a successful reset, reusing the same token returns 400."""
        register_user(client)
        from app.core.security import hash_reset_token
        from app.models.models import PasswordResetToken, User
        db = TestingSessionLocal()
        try:
            user = db.query(User).filter(User.email == CUSTOMER_EMAIL).first()
            future = datetime.now(tz=timezone.utc) + timedelta(minutes=30)
            raw = "validtokenvalue12345678901234xx"
            record = PasswordResetToken(
                user_id=user.id,
                token=hash_reset_token(raw),
                expires_at=future,
                used=False,
            )
            db.add(record)
            db.commit()
        finally:
            db.close()

        payload = {"token": raw, "new_password": "NewPass@999"}
        r1 = client.post("/api/v1/auth/reset-password", json=payload)
        assert r1.status_code == 200

        r2 = client.post("/api/v1/auth/reset-password", json=payload)
        assert r2.status_code == 400
        assert r2.json()["error"]["code"] == "BUSINESS_RULE"
