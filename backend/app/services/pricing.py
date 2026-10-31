"""
Pricing service.
All arithmetic uses Decimal; no floats.
"""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from app.models.models import Plan, Product, ProductVariant, TaxRule


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


def calculate_line_total(
    unit_price_val: Decimal,
    quantity: Decimal,
    discount: Decimal = Decimal("0.00"),
) -> Decimal:
    """
    line_total = (unit_price * quantity) - discount
    Quantized to 2 decimal places using ROUND_HALF_UP.
    """
    return quantize_money((Decimal(str(unit_price_val)) * Decimal(str(quantity))) - Decimal(str(discount)))


def calculate_subscription_totals(
    lines: list[Any],
    tax_rules_map: dict[int, TaxRule] | None = None,
) -> tuple[Decimal, Decimal, Decimal]:
    """
    Calculates (subtotal, tax_amount, total) for a collection of lines.
    lines can be SubscriptionLine or QuotationTemplateLine objects or dicts.
    tax_rules_map is a mapping of tax_rule_id -> TaxRule.
    """
    tax_rules_map = tax_rules_map or {}
    subtotal = Decimal("0.00")
    total_tax = Decimal("0.00")

    for line in lines:
        u_price = getattr(line, "unit_price", None)
        qty = getattr(line, "quantity", None)
        disc = getattr(line, "discount", Decimal("0.00"))
        tax_id = getattr(line, "tax_rule_id", None)

        if isinstance(line, dict):
            u_price = line.get("unit_price")
            qty = line.get("quantity")
            disc = line.get("discount", Decimal("0.00"))
            tax_id = line.get("tax_rule_id")

        lt = calculate_line_total(Decimal(str(u_price)), Decimal(str(qty)), Decimal(str(disc or "0.00")))
        subtotal += lt

        if tax_id and tax_id in tax_rules_map:
            rule = tax_rules_map[tax_id]
            rate = Decimal(str(rule.rate_percent))
            line_tax = quantize_money(lt * (rate / Decimal("100.00")))
            total_tax += line_tax

    subtotal = quantize_money(subtotal)
    total_tax = quantize_money(total_tax)
    total = quantize_money(subtotal + total_tax)
    return subtotal, total_tax, total
