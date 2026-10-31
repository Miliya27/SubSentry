"""
Pydantic schemas for user objects returned by the API.
hashed_password is excluded at all times.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.auth import validate_password_strength


class UserOut(BaseModel):
    """Public user representation – no sensitive fields."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    phone: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime


class CreateStaffRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: str
    password: str
    phone: Optional[str] = None

    @field_validator("password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        return validate_password_strength(v)
