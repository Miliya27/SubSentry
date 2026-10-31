"""
Pricing service.
All arithmetic uses Decimal; no floats.
"""
from __future__ import annotations

from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from app.models.models import DiscountRule, DiscountTypeEnum, Plan, Product, ProductVariant, TaxRule


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


# ---------------------------------------------------------------------------
# Discount and Invoice Calculation Order (Hour 5)
# ---------------------------------------------------------------------------

def find_best_discount_rule(
    base: Decimal,
    rules: list[DiscountRule],
    as_of_date: date | None = None,
) -> tuple[DiscountRule | None, Decimal]:
    """
    Find best eligible active discount rule for base amount.
    Eligible conditions:
      - is_active is True
      - as_of_date >= valid_from (if valid_from set)
      - as_of_date <= valid_until (if valid_until set)
      - uses_count < max_uses (if max_uses set)
      - base >= min_amount
    Discount computation:
      - percent: base * (value / 100)
      - fixed: min(value, base)
    Returns (best_rule, discount_amount). If none eligible or discount is 0, returns (None, 0.00).
    """
    base = quantize_money(base)
    best_rule: DiscountRule | None = None
    best_discount = Decimal("0.00")

    for rule in rules:
        if not rule.is_active:
            continue
        if as_of_date:
            if rule.valid_from and as_of_date < rule.valid_from:
                continue
            if rule.valid_until and as_of_date > rule.valid_until:
                continue
        if rule.max_uses is not None and rule.uses_count >= rule.max_uses:
            continue
        min_amt = Decimal(str(rule.min_amount or "0.00"))
        if base < min_amt:
            continue

        rule_val = Decimal(str(rule.value))
        rtype = rule.type.value if hasattr(rule.type, "value") else str(rule.type)
        if rtype == "percent":
            disc = quantize_money(base * (rule_val / Decimal("100.00")))
        else:
            disc = quantize_money(min(rule_val, base))

        if disc > best_discount:
            best_discount = disc
            best_rule = rule

    return best_rule, best_discount


def calculate_line_pricing(
    unit_price_val: Decimal,
    quantity: Decimal,
    tax_rate_percent: Decimal | None = None,
    discount_rule: DiscountRule | None = None,
    explicit_discount: Decimal = Decimal("0.00"),
) -> dict[str, Decimal]:
    """
    CALCULATION ORDER per line:
    1. unit_price = quantized to 2dp
    2. line_base = unit_price * qty (quantized to 2dp)
    3. discount = best eligible rule (or explicit_discount) quantized to 2dp
    4. taxable = line_base - discount (quantized to 2dp)
    5. tax = taxable * rate / 100 (quantized to 2dp)
    6. line_total = taxable + tax (quantized to 2dp)

    Worked example:
    2560 x 5 = 12800, 10% off = 1280, taxable 11520, 18% tax = 2073.60, total 13593.60
    """
    u_price = quantize_money(Decimal(str(unit_price_val)))
    qty = quantize_money(Decimal(str(quantity)))
    line_base = quantize_money(u_price * qty)

    if discount_rule is not None:
        rule_val = Decimal(str(discount_rule.value))
        rtype = discount_rule.type.value if hasattr(discount_rule.type, "value") else str(discount_rule.type)
        if rtype == "percent":
            discount = quantize_money(line_base * (rule_val / Decimal("100.00")))
        else:
            discount = quantize_money(min(rule_val, line_base))
    else:
        discount = quantize_money(Decimal(str(explicit_discount or "0.00")))
        discount = min(discount, line_base)

    taxable = quantize_money(line_base - discount)

    if tax_rate_percent is not None:
        rate = Decimal(str(tax_rate_percent))
        tax = quantize_money(taxable * (rate / Decimal("100.00")))
    else:
        tax = Decimal("0.00")

    line_total = quantize_money(taxable + tax)

    return {
        "unit_price": u_price,
        "quantity": qty,
        "line_base": line_base,
        "discount": discount,
        "taxable": taxable,
        "tax": tax,
        "line_total": line_total,
    }


def calculate_invoice_totals(
    lines_pricing: list[dict[str, Decimal]],
) -> tuple[Decimal, Decimal, Decimal, Decimal]:
    """
    Invoice totals = sums of line values.
    Returns (subtotal, discount_amount, tax_amount, total).
    where:
      subtotal = sum(line_base)
      discount_amount = sum(discount)
      tax_amount = sum(tax)
      total = sum(line_total) == subtotal - discount_amount + tax_amount
    """
    subtotal = quantize_money(sum((lp["line_base"] for lp in lines_pricing), Decimal("0.00")))
    discount_amount = quantize_money(sum((lp["discount"] for lp in lines_pricing), Decimal("0.00")))
    tax_amount = quantize_money(sum((lp["tax"] for lp in lines_pricing), Decimal("0.00")))
    total = quantize_money(sum((lp["line_total"] for lp in lines_pricing), Decimal("0.00")))
    return subtotal, discount_amount, tax_amount, total
