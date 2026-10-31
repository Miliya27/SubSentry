"""
Pydantic schemas for Product and ProductVariant endpoints.
Money fields are serialised as 2-decimal strings per the API contract.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.models import ProductTypeEnum


def _money(v: Any) -> str:
    """Coerce Decimal / str / int to a 2-decimal money string."""
    return f"{Decimal(str(v)):.2f}"


# ---------------------------------------------------------------------------
# Variant schemas
# ---------------------------------------------------------------------------

class VariantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    attribute: str      # e.g. "Brand"
    value: str          # e.g. "Odoo"
    extra_price: str    # money string, e.g. "560.00"
    sku: Optional[str] = None
    is_active: bool

    @field_validator("extra_price", mode="before")
    @classmethod
    def fmt_extra_price(cls, v: Any) -> str:
        return _money(v)


class CreateVariantRequest(BaseModel):
    attribute: str = Field(min_length=1, max_length=100)
    value: str = Field(min_length=1, max_length=100)
    extra_price: Decimal = Field(default=Decimal("0.00"), ge=0)
    sku: Optional[str] = Field(None, max_length=100)

    @field_validator("extra_price", mode="before")
    @classmethod
    def parse_extra(cls, v: Any) -> Decimal:
        return Decimal(str(v))


class UpdateVariantRequest(BaseModel):
    attribute: Optional[str] = Field(None, min_length=1, max_length=100)
    value: Optional[str] = Field(None, min_length=1, max_length=100)
    extra_price: Optional[Decimal] = Field(None, ge=0)
    sku: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None

    @field_validator("extra_price", mode="before")
    @classmethod
    def parse_extra(cls, v: Any) -> Optional[Decimal]:
        if v is None:
            return None
        return Decimal(str(v))


# ---------------------------------------------------------------------------
# Product schemas
# ---------------------------------------------------------------------------

class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    product_type: str
    sales_price: str    # money string
    cost_price: str     # money string
    description: Optional[str] = None
    unit: Optional[str] = None
    hsn_code: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool
    created_at: datetime
    variants: list[VariantOut] = []

    @field_validator("sales_price", "cost_price", mode="before")
    @classmethod
    def fmt_price(cls, v: Any) -> str:
        return _money(v)

    @field_validator("product_type", mode="before")
    @classmethod
    def fmt_type(cls, v: Any) -> str:
        return v.value if hasattr(v, "value") else str(v)


class CreateProductRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    product_type: ProductTypeEnum = ProductTypeEnum.software
    sales_price: Decimal = Field(default=Decimal("0.00"), ge=0)
    cost_price: Decimal = Field(default=Decimal("0.00"), ge=0)
    description: Optional[str] = None
    unit: Optional[str] = Field(None, max_length=50)
    hsn_code: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = None

    @field_validator("sales_price", "cost_price", mode="before")
    @classmethod
    def parse_price(cls, v: Any) -> Decimal:
        return Decimal(str(v))


class UpdateProductRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    product_type: Optional[ProductTypeEnum] = None
    sales_price: Optional[Decimal] = Field(None, ge=0)
    cost_price: Optional[Decimal] = Field(None, ge=0)
    description: Optional[str] = None
    unit: Optional[str] = Field(None, max_length=50)
    hsn_code: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("sales_price", "cost_price", mode="before")
    @classmethod
    def parse_price(cls, v: Any) -> Optional[Decimal]:
        if v is None:
            return None
        return Decimal(str(v))


# ---------------------------------------------------------------------------
# Price response schema
# ---------------------------------------------------------------------------

class PriceResponse(BaseModel):
    product_id: int
    variant_id: Optional[int]
    sales_price: str
    extra_price: str
    final_price: str
