"""
Billing engine service (Hour 5).
Handles scheduled billing runs, period computation, idempotency,
and draft invoice generation.
"""
from __future__ import annotations

import calendar
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.models import (
    BillingFrequencyEnum,
    Customer,
    DiscountRule,
    Invoice,
    InvoiceLine,
    InvoiceStatusEnum,
    Subscription,
    SubscriptionStatusEnum,
    TaxRule,
)
from app.services.pricing import (
    calculate_invoice_totals,
    calculate_line_pricing,
    find_best_discount_rule,
    money_str,
    quantize_money,
)


def add_period(d: date, frequency: BillingFrequencyEnum) -> date:
    """
    Add a billing period to date d.
    Daily: +1 day
    Weekly: +7 days
    Monthly: +1 month (clamping days: Jan 31 -> Feb 28/29)
    Yearly: +1 year (clamping days: Feb 29 -> Feb 28)
    """
    freq_str = frequency.value if hasattr(frequency, "value") else str(frequency)
    if freq_str == "daily":
        return d + timedelta(days=1)
    elif freq_str == "weekly":
        return d + timedelta(days=7)
    elif freq_str == "monthly":
        year = d.year + (d.month // 12)
        month = (d.month % 12) + 1
        max_day = calendar.monthrange(year, month)[1]
        day = min(d.day, max_day)
        return date(year, month, day)
    elif freq_str == "yearly":
        year = d.year + 1
        max_day = calendar.monthrange(year, d.month)[1]
        day = min(d.day, max_day)
        return date(year, d.month, day)
    else:
        # Default monthly
        year = d.year + (d.month // 12)
        month = (d.month % 12) + 1
        max_day = calendar.monthrange(year, month)[1]
        day = min(d.day, max_day)
        return date(year, month, day)


def generate_invoice_number(db: Session, year: int | None = None, offset: int = 0) -> str:
    """
    Generate unique identifier in INV-YYYY-NNNNN format.
    Safely increments based on current max in DB.
    """
    if year is None:
        year = datetime.now(timezone.utc).year
    prefix = f"INV-{year}-"
    latest = (
        db.query(Invoice.invoice_number)
        .filter(Invoice.invoice_number.like(f"{prefix}%"))
        .order_by(Invoice.invoice_number.desc())
        .first()
    )
    if latest and latest[0]:
        try:
            last_seq = int(latest[0].split("-")[-1])
            next_seq = last_seq + 1 + offset
        except (IndexError, ValueError):
            next_seq = 1 + offset
    else:
        next_seq = 1 + offset
    return f"{prefix}{next_seq:05d}"


def billing_run(
    db: Session,
    as_of_date: date,
    preview: bool = False,
) -> dict[str, Any]:
    """
    Run billing for all active subscriptions with next_billing_date <= as_of_date.
    Each subscription is processed within its own savepoint.
    Returns:
      {
        "created": int,
        "skipped": int,
        "failed": int,
        "invoice_ids": list[int],
        "errors": list[str],
        "would_create": int,
        "would_skip": int,
        "subscriptions": list[dict]
      }
    """
    # Find all active subscriptions due up to as_of_date
    subscriptions = (
        db.query(Subscription)
        .filter(
            Subscription.status == SubscriptionStatusEnum.active,
            Subscription.next_billing_date.isnot(None),
            Subscription.next_billing_date <= as_of_date,
        )
        .order_by(Subscription.id.asc())
        .all()
    )

    created_count = 0
    skipped_count = 0
    failed_count = 0
    invoice_ids: list[int] = []
    errors: list[str] = []
    preview_subs: list[dict[str, Any]] = []

    # Pre-fetch all active discount rules
    active_discounts = (
        db.query(DiscountRule)
        .filter(DiscountRule.is_active.is_(True))
        .all()
    )

    # Pre-fetch tax rules
    all_tax_rules = {tr.id: tr for tr in db.query(TaxRule).all()}

    # Track sequence offset within this run
    inv_offset = 0

    for sub in subscriptions:
        try:
            # Each subscription in its own savepoint
            if not preview:
                savepoint = db.begin_nested()

            # Process every due period for this subscription
            while sub.next_billing_date and sub.next_billing_date <= as_of_date:
                period_start = sub.next_billing_date

                # Check if subscription has expired before this period
                if sub.expiry_date and period_start > sub.expiry_date:
                    if not preview:
                        sub.status = SubscriptionStatusEnum.closed
                    break

                freq = sub.plan.billing_frequency if sub.plan else BillingFrequencyEnum.monthly
                next_period_start = add_period(period_start, freq)
                period_end = next_period_start - timedelta(days=1)

                # Pre-check idempotency / uniqueness
                existing = (
                    db.query(Invoice)
                    .filter(
                        Invoice.subscription_id == sub.id,
                        Invoice.period_start == period_start,
                    )
                    .first()
                )

                if existing:
                    skipped_count += 1
                    # Advance next_billing_date to avoid getting stuck
                    sub.next_billing_date = next_period_start
                    if sub.expiry_date and sub.next_billing_date > sub.expiry_date:
                        if not preview:
                            sub.status = SubscriptionStatusEnum.closed
                        break
                    continue

                # Calculate lines pricing
                lines_pricing: list[dict[str, Any]] = []
                for line in sub.lines:
                    tax_rule = all_tax_rules.get(line.tax_rule_id) if line.tax_rule_id else None
                    tax_rate = Decimal(str(tax_rule.rate_percent)) if tax_rule else None

                    # Find best eligible discount rule as of period_start
                    best_rule, _ = find_best_discount_rule(
                        base=quantize_money(line.unit_price * line.quantity),
                        rules=active_discounts,
                        as_of_date=period_start,
                    )

                    lp = calculate_line_pricing(
                        unit_price_val=line.unit_price,
                        quantity=line.quantity,
                        tax_rate_percent=tax_rate,
                        discount_rule=best_rule,
                        explicit_discount=line.discount,
                    )
                    lp["line_obj"] = line
                    lp["discount_rule"] = best_rule
                    lines_pricing.append(lp)

                subtotal, discount_amount, tax_amount, total = calculate_invoice_totals(lines_pricing)

                if preview:
                    created_count += 1
                    preview_subs.append({
                        "id": sub.id,
                        "customer_id": sub.customer_id,
                        "next_billing_date": str(period_start),
                        "total": money_str(total),
                    })
                    sub.next_billing_date = next_period_start
                    if sub.expiry_date and sub.next_billing_date > sub.expiry_date:
                        break
                else:
                    # Create Invoice
                    inv_num = generate_invoice_number(db, year=as_of_date.year, offset=inv_offset)
                    inv_offset += 1

                    due_date = as_of_date + timedelta(days=sub.payment_terms_days)

                    invoice = Invoice(
                        subscription_id=sub.id,
                        customer_id=sub.customer_id,
                        invoice_number=inv_num,
                        status=InvoiceStatusEnum.draft,
                        issue_date=as_of_date,
                        due_date=due_date,
                        period_start=period_start,
                        period_end=period_end,
                        subtotal=subtotal,
                        tax_amount=tax_amount,
                        discount_amount=discount_amount,
                        total=total,
                        notes=f"Auto-generated for subscription {sub.subscription_number or sub.id}",
                    )
                    db.add(invoice)
                    db.flush()  # assign invoice.id

                    # Create invoice lines
                    for lp in lines_pricing:
                        orig_line = lp["line_obj"]
                        disc_rule = lp["discount_rule"]
                        desc = None
                        if orig_line.product_variant and orig_line.product_variant.product:
                            desc = f"{orig_line.product_variant.product.name} ({orig_line.product_variant.value})"
                        inv_line = InvoiceLine(
                            invoice_id=invoice.id,
                            product_variant_id=orig_line.product_variant_id,
                            description=desc,
                            quantity=lp["quantity"],
                            unit_price=lp["unit_price"],
                            discount=lp["discount"],
                            tax_rule_id=orig_line.tax_rule_id,
                            line_total=lp["line_total"],
                            discount_rule_id=disc_rule.id if disc_rule else None,
                        )
                        db.add(inv_line)

                    created_count += 1
                    invoice_ids.append(invoice.id)

                    sub.next_billing_date = next_period_start
                    if sub.expiry_date and sub.next_billing_date > sub.expiry_date:
                        sub.status = SubscriptionStatusEnum.closed
                        break

            if not preview:
                db.commit()

        except IntegrityError as ie:
            if not preview:
                savepoint.rollback()
            skipped_count += 1
        except Exception as exc:
            if not preview:
                savepoint.rollback()
            failed_count += 1
            errors.append(f"Subscription {sub.id}: {str(exc)}")

    return {
        "created": created_count,
        "skipped": skipped_count,
        "failed": failed_count,
        "invoice_ids": invoice_ids,
        "errors": errors,
        "would_create": created_count,
        "would_skip": skipped_count,
        "subscriptions": preview_subs,
    }

