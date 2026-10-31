"""
Tests for pricing calculations and discount rules (Hour 5).
Includes the mandatory worked example:
2560 x 5 = 12800, 10% off = 1280, taxable 11520, 18% tax = 2073.60, total 13593.60.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
import pytest

from app.models.models import DiscountRule, DiscountTypeEnum
from app.services.pricing import (
    calculate_invoice_totals,
    calculate_line_pricing,
    find_best_discount_rule,
    money_str,
    quantize_money,
)


def test_worked_example_calculation():
    """
    Worked example:
    unit_price = 2560.00, qty = 5 -> base = 12800.00
    10% discount -> 1280.00
    taxable = 11520.00
    18% tax -> 2073.60
    total = 13593.60
    """
    rule_10 = DiscountRule(
        name="10% Off",
        type=DiscountTypeEnum.percent,
        value=Decimal("10.00"),
        min_amount=Decimal("0.00"),
        is_active=True,
    )

    res = calculate_line_pricing(
        unit_price_val=Decimal("2560.00"),
        quantity=Decimal("5.00"),
        tax_rate_percent=Decimal("18.00"),
        discount_rule=rule_10,
    )

    assert res["line_base"] == Decimal("12800.00")
    assert res["discount"] == Decimal("1280.00")
    assert res["taxable"] == Decimal("11520.00")
    assert res["tax"] == Decimal("2073.60")
    assert res["line_total"] == Decimal("13593.60")

    subtotal, discount_amount, tax_amount, total = calculate_invoice_totals([res])
    assert subtotal == Decimal("12800.00")
    assert discount_amount == Decimal("1280.00")
    assert tax_amount == Decimal("2073.60")
    assert total == Decimal("13593.60")


def test_fixed_discount_capped_at_base():
    """Fixed discount cannot exceed line base amount."""
    rule_fixed = DiscountRule(
        name="Big Fixed Off",
        type=DiscountTypeEnum.fixed,
        value=Decimal("500.00"),
        min_amount=Decimal("0.00"),
        is_active=True,
    )

    # Base is only 200.00
    res = calculate_line_pricing(
        unit_price_val=Decimal("100.00"),
        quantity=Decimal("2.00"),
        tax_rate_percent=Decimal("18.00"),
        discount_rule=rule_fixed,
    )

    assert res["line_base"] == Decimal("200.00")
    assert res["discount"] == Decimal("200.00")
    assert res["taxable"] == Decimal("0.00")
    assert res["tax"] == Decimal("0.00")
    assert res["line_total"] == Decimal("0.00")


def test_find_best_discount_rule_selection():
    """Selects rule that gives the largest discount value among eligible ones."""
    r1 = DiscountRule(
        id=1, name="5% Off", type=DiscountTypeEnum.percent,
        value=Decimal("5.00"), min_amount=Decimal("0.00"), is_active=True,
    )
    r2 = DiscountRule(
        id=2, name="Flat 200 Off", type=DiscountTypeEnum.fixed,
        value=Decimal("200.00"), min_amount=Decimal("0.00"), is_active=True,
    )
    r3 = DiscountRule(
        id=3, name="15% Off (Min 5000)", type=DiscountTypeEnum.percent,
        value=Decimal("15.00"), min_amount=Decimal("5000.00"), is_active=True,
    )

    # For base = 1000.00:
    # r1: 5% = 50.00
    # r2: flat = 200.00
    # r3: not eligible (min 5000)
    best, amt = find_best_discount_rule(Decimal("1000.00"), [r1, r2, r3])
    assert best == r2
    assert amt == Decimal("200.00")

    # For base = 10000.00:
    # r1: 5% = 500.00
    # r2: flat = 200.00
    # r3: 15% = 1500.00 -> winner!
    best2, amt2 = find_best_discount_rule(Decimal("10000.00"), [r1, r2, r3])
    assert best2 == r3
    assert amt2 == Decimal("1500.00")


def test_discount_rule_eligibility_window_and_usage():
    """Rules past valid_until or exceeding max_uses must be ignored."""
    expired = DiscountRule(
        name="Expired", type=DiscountTypeEnum.percent, value=Decimal("20.00"),
        min_amount=Decimal("0.00"), valid_until=date(2026, 1, 1), is_active=True,
    )
    maxed_out = DiscountRule(
        name="Maxed", type=DiscountTypeEnum.percent, value=Decimal("25.00"),
        min_amount=Decimal("0.00"), max_uses=5, uses_count=5, is_active=True,
    )
    active = DiscountRule(
        name="Active", type=DiscountTypeEnum.percent, value=Decimal("10.00"),
        min_amount=Decimal("0.00"), is_active=True,
    )

    best, amt = find_best_discount_rule(Decimal("1000.00"), [expired, maxed_out, active], as_of_date=date(2026, 6, 1))
    assert best == active
    assert amt == Decimal("100.00")

