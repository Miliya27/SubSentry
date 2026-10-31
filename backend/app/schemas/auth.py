"""
Pydantic schemas for auth endpoints.
Password validation raises per-rule 422 messages per the API contract.
"""
from __future__ import annotations

import re
from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------------------------------------------------------------------------
# Password validation helper (reused by register + reset)
# ---------------------------------------------------------------------------

def validate_password_strength(v: str) -> str:
    errors: list[str] = []
    if len(v) <= 8:
        errors.append("Password must be longer than 8 characters.")
    if not re.search(r"[A-Z]", v):
        errors.append("Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", v):
        errors.append("Password must contain at least one lowercase letter.")
    if not re.search(r"[^A-Za-z0-9]", v):
        errors.append("Password must contain at least one special character.")
    if errors:
        # Join all failures so field_validator returns a single error with all messages
        raise ValueError(" | ".join(errors))
    return v


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        return validate_password_strength(v)


class RegisterResponse(BaseModel):
    id: int
    email: str
    role: str


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


# ---------------------------------------------------------------------------
# Forgot / Reset password
# ---------------------------------------------------------------------------

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=1)
    new_password: str

    @field_validator("new_password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        return validate_password_strength(v)
