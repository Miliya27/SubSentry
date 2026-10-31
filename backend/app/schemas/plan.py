"""
Pydantic schemas for Plan endpoints.
price is serialised as a money string per the API contract.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.models import BillingFrequencyEnum


def _money(v: Any) -> str:
    return f"{Decimal(str(v)):.2f}"


class PlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    product_id: Optional[int] = None
    price: str          # money string
    billing_frequency: str
    min_quantity: int
    trial_days: int
    available_from: Optional[date] = None
    available_until: Optional[date] = None
    auto_close_days: Optional[int] = None
    allow_early_close: bool
    allow_pause: bool
    allow_renewal: bool
    is_active: bool
    created_at: datetime

    @field_validator("price", mode="before")
    @classmethod
    def fmt_price(cls, v: Any) -> str:
        return _money(v)

    @field_validator("billing_frequency", mode="before")
    @classmethod
    def fmt_freq(cls, v: Any) -> str:
        return v.value if hasattr(v, "value") else str(v)


class CreatePlanRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    product_id: int
    price: Decimal = Field(gt=0)
    billing_frequency: BillingFrequencyEnum
    min_quantity: int = Field(default=1, ge=1)
    trial_days: int = Field(default=0, ge=0)
    available_from: Optional[date] = None
    available_until: Optional[date] = None
    auto_close_days: Optional[int] = Field(None, ge=1)
    allow_early_close: bool = True
    allow_pause: bool = True
    allow_renewal: bool = True

    @field_validator("price", mode="before")
    @classmethod
    def parse_price(cls, v: Any) -> Decimal:
        return Decimal(str(v))

    @model_validator(mode="after")
    def validate_dates(self) -> "CreatePlanRequest":
        if self.available_from and self.available_until:
            if self.available_until < self.available_from:
                raise ValueError("available_until must be on or after available_from.")
        return self


class UpdatePlanRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    product_id: Optional[int] = None
    price: Optional[Decimal] = Field(None, gt=0)
    billing_frequency: Optional[BillingFrequencyEnum] = None
    min_quantity: Optional[int] = Field(None, ge=1)
    trial_days: Optional[int] = Field(None, ge=0)
    available_from: Optional[date] = None
    available_until: Optional[date] = None
    auto_close_days: Optional[int] = Field(None, ge=1)
    allow_early_close: Optional[bool] = None
    allow_pause: Optional[bool] = None
    allow_renewal: Optional[bool] = None
    is_active: Optional[bool] = None

    @field_validator("price", mode="before")
    @classmethod
    def parse_price(cls, v: Any) -> Optional[Decimal]:
        if v is None:
            return None
        return Decimal(str(v))

    @model_validator(mode="after")
    def validate_dates(self) -> "UpdatePlanRequest":
        if self.available_from and self.available_until:
            if self.available_until < self.available_from:
                raise ValueError("available_until must be on or after available_from.")
        return self
