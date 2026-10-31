"""
Finance and metrics calculation service (Hour 6 & Hour 7).
Single source of truth for invoice payment status, overdue logic,
and dashboard financial metrics (Decimal arithmetic and SQL aggregations only).
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.models import (
    BillingFrequencyEnum,
    Invoice,
    InvoiceStatusEnum,
    Payment,
    Subscription,
    SubscriptionStatusEnum,
)
from app.services.pricing import quantize_money


def compute_invoice_financials(
    invoice: Invoice,
    today: Optional[date] = None,
) -> tuple[Decimal, Decimal, str, bool]:
    """
    Returns (amount_paid, outstanding, payment_state, is_overdue)
    for a given invoice.
    All money arithmetic uses Decimal and quantize_money (ROUND_HALF_UP, 2dp).
    """
    today = today or date.today()

    amount_paid = quantize_money(sum((p.amount for p in invoice.payments), Decimal("0.00")))
    outstanding = quantize_money(max(Decimal("0.00"), Decimal(str(invoice.total)) - amount_paid))

    if amount_paid == Decimal("0.00"):
        payment_state = "unpaid"
    elif amount_paid >= Decimal(str(invoice.total)):
        payment_state = "paid"
    else:
        payment_state = "partially_paid"

    status_str = invoice.status.value if hasattr(invoice.status, "value") else str(invoice.status)
    is_overdue = (
        status_str == "confirmed"
        and outstanding > Decimal("0.00")
        and invoice.due_date < today
    )

    return amount_paid, outstanding, payment_state, is_overdue


def get_invoice_amount_paid_db(db: Session, invoice_id: int) -> Decimal:
    """
    Re-read the SUM of payments inside the same transaction before inserting.
    """
    total = (
        db.query(func.coalesce(func.sum(Payment.amount), Decimal("0.00")))
        .filter(Payment.invoice_id == invoice_id)
        .scalar()
    )
    return quantize_money(Decimal(str(total or "0.00")))


def revenue_received(
    db: Session,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
) -> Decimal:
    """
    Sum of payments received within date range [from_date, to_date].
    Uses SQL aggregation.
    """
    query = db.query(func.coalesce(func.sum(Payment.amount), Decimal("0.00")))
    if from_date:
        query = query.filter(Payment.payment_date >= from_date)
    if to_date:
        query = query.filter(Payment.payment_date <= to_date)
    val = query.scalar()
    return quantize_money(Decimal(str(val or "0.00")))


def total_invoiced(
    db: Session,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
) -> Decimal:
    """
    Sum of invoice totals for confirmed or paid invoices within issue_date range [from_date, to_date].
    Uses SQL aggregation.
    """
    query = db.query(func.coalesce(func.sum(Invoice.total), Decimal("0.00"))).filter(
        Invoice.status.in_([InvoiceStatusEnum.confirmed, InvoiceStatusEnum.paid])
    )
    if from_date:
        query = query.filter(Invoice.issue_date >= from_date)
    if to_date:
        query = query.filter(Invoice.issue_date <= to_date)
    val = query.scalar()
    return quantize_money(Decimal(str(val or "0.00")))


def outstanding_total(db: Session) -> Decimal:
    """
    Sum of outstanding amounts across all confirmed (unpaid or partially paid) invoices.
    Uses SQL aggregation.
    """
    tot_confirmed = (
        db.query(func.coalesce(func.sum(Invoice.total), Decimal("0.00")))
        .filter(Invoice.status == InvoiceStatusEnum.confirmed)
        .scalar()
        or Decimal("0.00")
    )
    paid_on_confirmed = (
        db.query(func.coalesce(func.sum(Payment.amount), Decimal("0.00")))
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .filter(Invoice.status == InvoiceStatusEnum.confirmed)
        .scalar()
        or Decimal("0.00")
    )
    return quantize_money(max(Decimal("0.00"), Decimal(str(tot_confirmed)) - Decimal(str(paid_on_confirmed))))


def overdue_metrics(
    db: Session,
    as_of_date: Optional[date] = None,
) -> tuple[int, Decimal]:
    """
    Returns (overdue_count, overdue_amount) on confirmed invoices where due_date < as_of_date.
    Uses SQL aggregation.
    """
    as_of_date = as_of_date or date.today()
    count = (
        db.query(func.count(Invoice.id))
        .filter(
            Invoice.status == InvoiceStatusEnum.confirmed,
            Invoice.due_date < as_of_date,
        )
        .scalar()
        or 0
    )
    if count == 0:
        return 0, Decimal("0.00")

    tot_overdue = (
        db.query(func.coalesce(func.sum(Invoice.total), Decimal("0.00")))
        .filter(
            Invoice.status == InvoiceStatusEnum.confirmed,
            Invoice.due_date < as_of_date,
        )
        .scalar()
        or Decimal("0.00")
    )
    paid_overdue = (
        db.query(func.coalesce(func.sum(Payment.amount), Decimal("0.00")))
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .filter(
            Invoice.status == InvoiceStatusEnum.confirmed,
            Invoice.due_date < as_of_date,
        )
        .scalar()
        or Decimal("0.00")
    )
    amount = quantize_money(max(Decimal("0.00"), Decimal(str(tot_overdue)) - Decimal(str(paid_overdue))))
    return count, amount


def overdue_total(db: Session, as_of_date: Optional[date] = None) -> Decimal:
    """Convenience helper returning only the overdue amount."""
    return overdue_metrics(db, as_of_date=as_of_date)[1]


def mrr(db: Session) -> Decimal:
    """
    Monthly Recurring Revenue from active subscriptions.
    Frequencies normalized to monthly:
      - monthly: base
      - yearly: base / 12
      - weekly: base * 52 / 12
      - daily: base * 365 / 12
    """
    active_subs = (
        db.query(Subscription)
        .filter(Subscription.status == SubscriptionStatusEnum.active)
        .all()
    )

    total_mrr = Decimal("0.00")
    for sub in active_subs:
        sub_base = Decimal("0.00")
        if sub.lines:
            for line in sub.lines:
                sub_base += Decimal(str(line.unit_price)) * Decimal(str(line.quantity))
        elif sub.plan:
            sub_base = Decimal(str(sub.plan.price))

        freq = sub.plan.billing_frequency if sub.plan else BillingFrequencyEnum.monthly
        freq_str = freq.value if hasattr(freq, "value") else str(freq)

        if freq_str == "monthly":
            monthly_val = sub_base
        elif freq_str == "yearly":
            monthly_val = sub_base / Decimal("12")
        elif freq_str == "weekly":
            monthly_val = sub_base * Decimal("52") / Decimal("12")
        elif freq_str == "daily":
            monthly_val = sub_base * Decimal("365") / Decimal("12")
        else:
            monthly_val = sub_base

        total_mrr += monthly_val

    return quantize_money(total_mrr)


def arr(db: Session) -> Decimal:
    """Annual Recurring Revenue = MRR * 12."""
    return quantize_money(mrr(db) * Decimal("12"))


def customer_financial_metrics(db: Session, customer_id: int) -> dict[str, Any]:
    """
    Calculates dashboard metrics for a single customer using pure SQL aggregation.
    """
    active_subs = (
        db.query(func.count(Subscription.id))
        .filter(
            Subscription.customer_id == customer_id,
            Subscription.status == SubscriptionStatusEnum.active,
        )
        .scalar()
        or 0
    )
    tot_invoiced = (
        db.query(func.coalesce(func.sum(Invoice.total), Decimal("0.00")))
        .filter(
            Invoice.customer_id == customer_id,
            Invoice.status.in_([InvoiceStatusEnum.confirmed, InvoiceStatusEnum.paid]),
        )
        .scalar()
        or Decimal("0.00")
    )
    paid = (
        db.query(func.coalesce(func.sum(Payment.amount), Decimal("0.00")))
        .filter(Payment.customer_id == customer_id)
        .scalar()
        or Decimal("0.00")
    )
    conf_tot = (
        db.query(func.coalesce(func.sum(Invoice.total), Decimal("0.00")))
        .filter(
            Invoice.customer_id == customer_id,
            Invoice.status == InvoiceStatusEnum.confirmed,
        )
        .scalar()
        or Decimal("0.00")
    )
    conf_paid = (
        db.query(func.coalesce(func.sum(Payment.amount), Decimal("0.00")))
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .filter(
            Invoice.customer_id == customer_id,
            Invoice.status == InvoiceStatusEnum.confirmed,
        )
        .scalar()
        or Decimal("0.00")
    )
    out = quantize_money(max(Decimal("0.00"), Decimal(str(conf_tot)) - Decimal(str(conf_paid))))
    od_count = (
        db.query(func.count(Invoice.id))
        .filter(
            Invoice.customer_id == customer_id,
            Invoice.status == InvoiceStatusEnum.confirmed,
            Invoice.due_date < date.today(),
        )
        .scalar()
        or 0
    )
    next_sub = (
        db.query(Subscription.next_billing_date)
        .filter(
            Subscription.customer_id == customer_id,
            Subscription.status == SubscriptionStatusEnum.active,
            Subscription.next_billing_date >= date.today(),
        )
        .order_by(Subscription.next_billing_date.asc())
        .first()
    )
    next_renewal = str(next_sub[0]) if next_sub and next_sub[0] else None

    return {
        "active_subscriptions": active_subs,
        "total_invoiced": quantize_money(Decimal(str(tot_invoiced))),
        "amount_paid": quantize_money(Decimal(str(paid))),
        "outstanding": out,
        "overdue_count": od_count,
        "next_renewal": next_renewal,
    }
