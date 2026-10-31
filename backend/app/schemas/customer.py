"""
Pydantic schemas for Customer endpoints.
Money fields formatted as 2-decimal strings per the API contract.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _money(v: Any) -> str:
    return f"{Decimal(str(v)):.2f}"


class CustomerUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    phone: Optional[str] = None


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    company_name: Optional[str] = None
    gstin: Optional[str] = None
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    credit_limit: str
    outstanding_balance: str
    created_at: datetime
    user: Optional[CustomerUserOut] = None

    @field_validator("credit_limit", "outstanding_balance", mode="before")
    @classmethod
    def fmt_money(cls, v: Any) -> str:
        return _money(v)


class CreateCustomerRequest(BaseModel):
    user_id: int
    company_name: Optional[str] = Field(None, max_length=255)
    gstin: Optional[str] = Field(None, max_length=15)
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    credit_limit: Decimal = Field(default=Decimal("0.00"), ge=0)

    @field_validator("credit_limit", mode="before")
    @classmethod
    def parse_credit(cls, v: Any) -> Decimal:
        return Decimal(str(v))


class UpdateCustomerRequest(BaseModel):
    company_name: Optional[str] = Field(None, max_length=255)
    gstin: Optional[str] = Field(None, max_length=15)
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    credit_limit: Optional[Decimal] = Field(None, ge=0)

    @field_validator("credit_limit", mode="before")
    @classmethod
    def parse_credit(cls, v: Any) -> Optional[Decimal]:
        if v is None:
            return None
        return Decimal(str(v))

