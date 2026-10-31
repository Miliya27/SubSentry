"""
Pydantic schemas for Subscription endpoints.
Money/quantity fields formatted as 2-decimal strings per the API contract.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _money(v: Any) -> str:
    return f"{Decimal(str(v)):.2f}"


class SubscriptionLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subscription_id: int
    product_variant_id: Optional[int] = None
    quantity: str
    unit_price: str
    discount: str
    tax_rule_id: Optional[int] = None
    line_total: str

    @field_validator("quantity", "unit_price", "discount", "line_total", mode="before")
    @classmethod
    def fmt_money(cls, v: Any) -> str:
        return _money(v)


class SubscriptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subscription_number: Optional[str] = None
    customer_id: int
    plan_id: int
    product_variant_id: Optional[int] = None
    status: str
    start_date: date
    expiry_date: Optional[date] = None
    payment_terms_days: int
    trial_end_date: Optional[date] = None
    next_billing_date: Optional[date] = None
    quotation_valid_until: Optional[date] = None
    cancelled_at: Optional[datetime] = None
    created_at: datetime
    lines: list[SubscriptionLineOut] = []
    subtotal: Optional[str] = None
    tax_amount: Optional[str] = None
    total: str

    @field_validator("status", mode="before")
    @classmethod
    def fmt_status(cls, v: Any) -> str:
        return v.value if hasattr(v, "value") else str(v)

    @field_validator("subtotal", "tax_amount", "total", mode="before")
    @classmethod
    def fmt_money(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        return _money(v)


class CreateSubscriptionLineRequest(BaseModel):
    product_variant_id: Optional[int] = None
    quantity: Decimal = Field(default=Decimal("1.00"), gt=0)
    discount: Decimal = Field(default=Decimal("0.00"), ge=0)
    tax_rule_id: Optional[int] = None

    @field_validator("quantity", "discount", mode="before")
    @classmethod
    def parse_decimal(cls, v: Any) -> Decimal:
        return Decimal(str(v))


class CreateSubscriptionRequest(BaseModel):
    customer_id: int
    plan_id: int
    product_variant_id: Optional[int] = None
    start_date: date
    expiry_date: Optional[date] = None
    payment_terms_days: int = Field(default=0, ge=0)
    lines: list[CreateSubscriptionLineRequest] = Field(min_length=1)


class CreateSubscriptionFromTemplateRequest(BaseModel):
    template_id: int
    customer_id: int
    plan_id: int
    start_date: date
    expiry_date: Optional[date] = None
    payment_terms_days: int = Field(default=0, ge=0)


class UpdateSubscriptionRequest(BaseModel):
    start_date: Optional[date] = None
    expiry_date: Optional[date] = None
    payment_terms_days: Optional[int] = Field(None, ge=0)
    lines: Optional[list[CreateSubscriptionLineRequest]] = None

