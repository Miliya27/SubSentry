"""
Pydantic schemas for Invoices (API Contract 8.9).
Money fields serialized as 2-decimal strings.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.models import InvoiceStatusEnum
from app.services.pricing import quantize_money


class InvoiceLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_variant_id: Optional[int] = None
    description: Optional[str] = None
    quantity: str
    unit_price: str
    discount: str
    tax_rule_id: Optional[int] = None
    line_total: str

    @field_validator("quantity", "unit_price", "discount", "line_total", mode="before")
    @classmethod
    def serialize_money(cls, v):
        if v is None:
            return "0.00"
        return str(quantize_money(Decimal(str(v))))


class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subscription_id: Optional[int] = None
    customer_id: int
    invoice_number: str
    status: InvoiceStatusEnum
    issue_date: date
    due_date: date
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    subtotal: str
    tax_amount: str
    discount_amount: str
    total: str
    amount_paid: str = "0.00"
    outstanding: str = "0.00"
    notes: Optional[str] = None
    sent_at: Optional[datetime] = None
    created_at: datetime

    @field_validator("status", mode="before")
    @classmethod
    def serialize_status(cls, v):
        if hasattr(v, "value"):
            return v.value
        return v

    @field_validator("subtotal", "tax_amount", "discount_amount", "total", "amount_paid", "outstanding", mode="before")
    @classmethod
    def serialize_money(cls, v):
        if v is None:
            return "0.00"
        return str(quantize_money(Decimal(str(v))))


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_id: int
    customer_id: int
    amount: str
    payment_date: date
    method: str
    reference: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    @field_validator("method", mode="before")
    @classmethod
    def serialize_method(cls, v):
        if hasattr(v, "value"):
            return v.value
        return v

    @field_validator("amount", mode="before")
    @classmethod
    def serialize_amount(cls, v):
        return str(quantize_money(Decimal(str(v))))


class InvoiceDetailOut(InvoiceOut):
    lines: list[InvoiceLineOut] = []
    payments: list[PaymentOut] = []


class TaxBreakdownItem(BaseModel):
    name: str
    rate: str
    taxable_amount: str
    tax: str


class InvoicePrintOut(BaseModel):
    invoice: InvoiceOut
    customer: dict[str, Any]
    lines: list[InvoiceLineOut]
    payments: list[PaymentOut]
    tax_breakdown: list[TaxBreakdownItem]

