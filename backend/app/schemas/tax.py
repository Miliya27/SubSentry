"""
Pydantic schemas for TaxRule endpoints.
rate_percent is serialised as a 2-decimal string per the API contract.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.models import TaxAppliesToEnum


def _rate_str(v: Any) -> str:
    return f"{Decimal(str(v)):.2f}"


class TaxRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    rate_percent: str           # percent string e.g. "18.00"
    rate: str                   # backwards-compatible alias
    is_default: bool = False
    is_active: bool
    applies_to: Optional[str] = None
    hsn_code: Optional[str] = None

    @field_validator("rate_percent", "rate", mode="before")
    @classmethod
    def fmt_rate(cls, v: Any) -> str:
        return _rate_str(v)

    @field_validator("applies_to", mode="before")
    @classmethod
    def fmt_applies(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        return v.value if hasattr(v, "value") else str(v)


class CreateTaxRuleRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    rate_percent: Optional[Decimal] = Field(None, ge=Decimal("0"), le=Decimal("100"))
    rate: Optional[Decimal] = Field(None, ge=Decimal("0"), le=Decimal("100"))
    is_default: bool = False
    applies_to: Optional[TaxAppliesToEnum] = TaxAppliesToEnum.all
    hsn_code: Optional[str] = Field(None, max_length=20)

    @field_validator("rate_percent", "rate", mode="before")
    @classmethod
    def parse_rate(cls, v: Any) -> Optional[Decimal]:
        if v is None:
            return None
        return Decimal(str(v))

    @model_validator(mode="before")
    @classmethod
    def resolve_rate_before(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if data.get("rate_percent") is None and data.get("rate") is not None:
                data["rate_percent"] = data["rate"]
            elif data.get("rate") is None and data.get("rate_percent") is not None:
                data["rate"] = data["rate_percent"]
        return data

    @model_validator(mode="after")
    def validate_rules(self) -> "CreateTaxRuleRequest":
        if self.rate_percent is None:
            raise ValueError("rate_percent is required")
        if self.applies_to == TaxAppliesToEnum.hsn and not self.hsn_code:
            raise ValueError("hsn_code is required when applies_to is 'hsn'.")
        return self


class UpdateTaxRuleRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    rate_percent: Optional[Decimal] = Field(None, ge=Decimal("0"), le=Decimal("100"))
    rate: Optional[Decimal] = Field(None, ge=Decimal("0"), le=Decimal("100"))
    is_default: Optional[bool] = None
    hsn_code: Optional[str] = Field(None, max_length=20)
    applies_to: Optional[TaxAppliesToEnum] = None
    is_active: Optional[bool] = None

    @field_validator("rate_percent", "rate", mode="before")
    @classmethod
    def parse_rate(cls, v: Any) -> Optional[Decimal]:
        if v is None:
            return None
        return Decimal(str(v))

    @model_validator(mode="before")
    @classmethod
    def resolve_rate_before(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if data.get("rate_percent") is None and data.get("rate") is not None:
                data["rate_percent"] = data["rate"]
            elif data.get("rate") is None and data.get("rate_percent") is not None:
                data["rate"] = data["rate_percent"]
        return data
