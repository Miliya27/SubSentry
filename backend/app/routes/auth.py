"""
Auth routes: register, login, me, forgot-password, reset-password.
All follow the error envelope in docs/API_CONTRACT.md exactly.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import CurrentUserDep, DbDep
from app.core.security import (
    create_access_token,
    generate_reset_token,
    hash_password,
    hash_reset_token,
    verify_password,
)
from app.models.models import Customer, PasswordResetToken, RoleEnum, User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    ResetPasswordRequest,
    TokenResponse,
)
from app.schemas.user import UserOut
from app.services.mailer import send_password_reset_email

router = APIRouter(prefix="/auth", tags=["auth"])


def _conflict(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={"success": False, "error": {"code": "CONFLICT", "message": message, "details": None}},
    )


def _business_rule(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"success": False, "error": {"code": "BUSINESS_RULE", "message": message, "details": None}},
    )


def _not_found(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"success": False, "error": {"code": "NOT_FOUND", "message": message, "details": None}},
    )


# ---------------------------------------------------------------------------
# POST /auth/register
# ---------------------------------------------------------------------------

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: DbDep):
    """Public. Creates a customer user + linked Customer profile."""
    # 409 if email already exists
    if db.query(User).filter(User.email == body.email).first():
        raise _conflict("An account with this email address already exists.")

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=RoleEnum.customer,
        is_active=True,
    )
    db.add(user)
    db.flush()  # get user.id before creating Customer

    customer = Customer(user_id=user.id)
    db.add(customer)
    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "data": RegisterResponse(id=user.id, email=user.email, role=user.role.value),
        "message": "Account created",
    }


# ---------------------------------------------------------------------------
# POST /auth/login
# ---------------------------------------------------------------------------

@router.post("/login")
def login(body: LoginRequest, db: DbDep):
    """Public. Returns a JWT access token."""
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "success": False,
                "error": {
                    "code": "UNAUTHENTICATED",
                    "message": "Invalid email or password.",
                    "details": None,
                },
            },
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "success": False,
                "error": {
                    "code": "UNAUTHENTICATED",
                    "message": "Account is deactivated.",
                    "details": None,
                },
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(subject=user.id, role=user.role.value)
    expires_in = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60

    return {
        "success": True,
        "data": TokenResponse(access_token=token, token_type="bearer", expires_in=expires_in),
        "message": "OK",
    }


# ---------------------------------------------------------------------------
# GET /auth/me
# ---------------------------------------------------------------------------

@router.get("/me")
def get_me(current_user: CurrentUserDep):
    """Returns the authenticated user's profile."""
    return {
        "success": True,
        "data": UserOut.model_validate(current_user),
        "message": "OK",
    }


# ---------------------------------------------------------------------------
# POST /auth/forgot-password
# ---------------------------------------------------------------------------

@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: DbDep):
    """
    Public. Always returns the same neutral response to prevent user enumeration.
    If the email exists, stores a SHA-256 hashed token with 30-min expiry.
    """
    neutral_response = {
        "success": True,
        "data": {"message": "If that address is registered you will receive a reset link."},
        "message": "OK",
    }

    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.is_active:
        return neutral_response  # don't reveal whether the email exists

    raw_token, token_hash = generate_reset_token()
    expires = datetime.now(tz=timezone.utc) + timedelta(minutes=30)

    reset_token = PasswordResetToken(
        user_id=user.id,
        token=token_hash,  # only the hash is stored
        expires_at=expires,
        used=False,
    )
    db.add(reset_token)
    db.commit()

    # Build the reset link (frontend URL + raw token)
    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"
    send_password_reset_email(to_email=user.email, reset_link=reset_link)

    return neutral_response


# ---------------------------------------------------------------------------
# POST /auth/reset-password
# ---------------------------------------------------------------------------

@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: DbDep):
    """
    Public. Validates token (existence, expiry, not used), hashes new
    password, marks token used.
    """
    token_hash = hash_reset_token(body.token)
    record = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token == token_hash)
        .first()
    )

    if record is None:
        raise _not_found("Reset token not found.")

    now = datetime.now(tz=timezone.utc)
    # expires_at may be naive (SQLite stores without tz); normalise
    expires = record.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)

    if now > expires:
        raise _business_rule("Reset token has expired. Request a new one.")
    if record.used:
        raise _business_rule("Reset token has already been used.")

    # Update password and mark token used
    user = db.get(User, record.user_id)
    if not user or not user.is_active:
        raise _not_found("Associated user not found.")

    user.hashed_password = hash_password(body.new_password)
    record.used = True
    db.commit()

    return {
        "success": True,
        "data": {"message": "Password updated successfully."},
        "message": "OK",
    }
