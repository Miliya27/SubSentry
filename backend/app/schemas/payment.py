"""
Pydantic schemas for Payments (API Contract 8.12).
Money fields serialized as 2-decimal strings.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.models import PaymentMethodEnum
from app.services.pricing import quantize_money


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


class CreatePaymentRequest(BaseModel):
    method: PaymentMethodEnum
    amount: Decimal = Field(..., gt=Decimal("0.00"))
    payment_date: date
    reference: Optional[str] = None
    notes: Optional[str] = None


class InvoicePaymentSummary(BaseModel):
    id: int
    status: str
    total: str
    amount_paid: str
    outstanding: str
    payment_state: str

    @field_validator("total", "amount_paid", "outstanding", mode="before")
    @classmethod
    def serialize_money(cls, v):
        return str(quantize_money(Decimal(str(v))))


class PaymentRecordOut(BaseModel):
    payment: PaymentOut
    invoice: InvoicePaymentSummary

