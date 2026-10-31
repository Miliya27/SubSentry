"""
Pydantic schemas for Discount rules (API Contract 8.11).
Money fields serialized as 2-decimal strings.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.models import DiscountTypeEnum
from app.services.pricing import quantize_money


class DiscountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: DiscountTypeEnum
    value: str
    min_amount: str
    max_uses: Optional[int] = None
    uses_count: int
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None
    is_active: bool

    @field_validator("type", mode="before")
    @classmethod
    def serialize_type(cls, v):
        if hasattr(v, "value"):
            return v.value
        return v

    @field_validator("value", mode="before")
    @classmethod
    def serialize_value(cls, v):
        return str(quantize_money(Decimal(str(v))))

    @field_validator("min_amount", mode="before")
    @classmethod
    def serialize_min_amount(cls, v):
        return str(quantize_money(Decimal(str(v or "0.00"))))


class CreateDiscountRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: DiscountTypeEnum
    value: Decimal = Field(..., gt=Decimal("0.00"))
    min_amount: Optional[Decimal] = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    max_uses: Optional[int] = Field(default=None, ge=1)
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None
    is_active: Optional[bool] = True

    @model_validator(mode="after")
    def validate_rules(self) -> "CreateDiscountRequest":
        if self.type == DiscountTypeEnum.percent and self.value > Decimal("100.00"):
            raise ValueError("Percentage discount value cannot exceed 100")
        if self.valid_from and self.valid_until and self.valid_until < self.valid_from:
            raise ValueError("valid_until must be on or after valid_from")
        return self


class UpdateDiscountRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    type: Optional[DiscountTypeEnum] = None
    value: Optional[Decimal] = Field(default=None, gt=Decimal("0.00"))
    min_amount: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"))
    max_uses: Optional[int] = Field(default=None, ge=1)
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None
    is_active: Optional[bool] = None

    @model_validator(mode="after")
    def validate_rules(self) -> "UpdateDiscountRequest":
        if self.type == DiscountTypeEnum.percent and self.value is not None and self.value > Decimal("100.00"):
            raise ValueError("Percentage discount value cannot exceed 100")
        if self.valid_from and self.valid_until and self.valid_until < self.valid_from:
            raise ValueError("valid_until must be on or after valid_from")
        return self

