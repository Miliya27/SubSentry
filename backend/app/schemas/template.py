"""
Pydantic schemas for Quotation Template endpoints.
Money/quantity fields formatted as 2-decimal strings per the API contract.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.models import QuotationStatusEnum


def _money(v: Any) -> str:
    return f"{Decimal(str(v)):.2f}"


class TemplateLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    template_id: int
    product_variant_id: Optional[int] = None
    description: Optional[str] = None
    quantity: str
    unit_price: str
    discount: str
    tax_rule_id: Optional[int] = None
    line_total: str

    @field_validator("quantity", "unit_price", "discount", "line_total", mode="before")
    @classmethod
    def fmt_money(cls, v: Any) -> str:
        return _money(v)


class QuotationTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    customer_id: Optional[int] = None
    status: str
    valid_until: Optional[date] = None
    validity_days: Optional[int] = 30
    notes: Optional[str] = None
    created_at: datetime
    lines: list[TemplateLineOut] = []

    @field_validator("status", mode="before")
    @classmethod
    def fmt_status(cls, v: Any) -> str:
        return v.value if hasattr(v, "value") else str(v)


class CreateTemplateLineRequest(BaseModel):
    product_variant_id: Optional[int] = None
    description: Optional[str] = None
    quantity: Decimal = Field(default=Decimal("1.00"), gt=0)
    unit_price: Decimal = Field(ge=0)
    discount: Decimal = Field(default=Decimal("0.00"), ge=0)
    tax_rule_id: Optional[int] = None

    @field_validator("quantity", "unit_price", "discount", mode="before")
    @classmethod
    def parse_decimal(cls, v: Any) -> Decimal:
        return Decimal(str(v))


class CreateTemplateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    customer_id: Optional[int] = None
    valid_until: Optional[date] = None
    validity_days: Optional[int] = Field(default=30, ge=1)
    notes: Optional[str] = None
    lines: list[CreateTemplateLineRequest] = []


class UpdateTemplateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    customer_id: Optional[int] = None
    status: Optional[QuotationStatusEnum] = None
    valid_until: Optional[date] = None
    validity_days: Optional[int] = Field(None, ge=1)
    notes: Optional[str] = None
    lines: Optional[list[CreateTemplateLineRequest]] = None

