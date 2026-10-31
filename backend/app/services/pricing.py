"""
Pricing service – first part.
All arithmetic uses Decimal; no floats.
"""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from app.models.models import Plan, Product, ProductVariant


# Money quantizer: always 2 decimal places, ROUND_HALF_UP
CENTS = Decimal("0.01")


def quantize_money(value: Decimal) -> Decimal:
    """Round a Decimal to 2 decimal places using ROUND_HALF_UP and return Decimal."""
    return value.quantize(CENTS, rounding=ROUND_HALF_UP)


def money_str(value: Decimal) -> str:
    """Return a money value as a JSON-safe 2-decimal string per the API contract."""
    return str(quantize_money(value))


def calculate_product_price(
    product: Product,
    variant: ProductVariant | None = None,
) -> tuple[Decimal, Decimal, Decimal]:
    """
    Compute final price for a product + optional variant.
    final_price = product.sales_price + variant.extra_price
    All arithmetic uses Decimal and ROUND_HALF_UP.
    Returns (sales_price, extra_price, final_price).
    """
    sales_price = quantize_money(Decimal(str(product.sales_price)))
    extra_price = quantize_money(Decimal(str(variant.extra_price))) if variant else Decimal("0.00")
    final_price = quantize_money(sales_price + extra_price)
    return sales_price, extra_price, final_price


def unit_price(plan: Plan, variant: ProductVariant | None) -> Decimal:
    """
    Final per-unit price = plan.price + variant.extra_price.
    If no variant is supplied the extra is 0.
    The result is quantized to 2 decimal places.
    """
    base: Decimal = Decimal(str(plan.price))
    extra: Decimal = Decimal(str(variant.extra_price)) if variant else Decimal("0.00")
    return quantize_money(base + extra)
