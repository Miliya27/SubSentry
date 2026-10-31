"""
Finance and metrics calculation service (Hour 6).
Single source of truth for invoice payment status, overdue logic,
and dashboard financial metrics (Decimal arithmetic only).
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

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
    """
    query = db.query(func.coalesce(func.sum(Payment.amount), Decimal("0.00")))
    if from_date:
        query = query.filter(Payment.payment_date >= from_date)
    if to_date:
        query = query.filter(Payment.payment_date <= to_date)
    val = query.scalar()
    return quantize_money(Decimal(str(val or "0.00")))


def outstanding_total(db: Session) -> Decimal:
    """
    Sum of outstanding amounts across all confirmed (unpaid or partially paid) invoices.
    """
    confirmed = (
        db.query(Invoice)
        .filter(Invoice.status == InvoiceStatusEnum.confirmed)
        .all()
    )
    tot = sum((compute_invoice_financials(inv)[1] for inv in confirmed), Decimal("0.00"))
    return quantize_money(tot)


def overdue_total(db: Session, as_of_date: Optional[date] = None) -> Decimal:
    """
    Sum of outstanding amounts on overdue confirmed invoices.
    """
    as_of_date = as_of_date or date.today()
    overdue_invoices = (
        db.query(Invoice)
        .filter(
            Invoice.status == InvoiceStatusEnum.confirmed,
            Invoice.due_date < as_of_date,
        )
        .all()
    )
    tot = sum((compute_invoice_financials(inv, today=as_of_date)[1] for inv in overdue_invoices), Decimal("0.00"))
    return quantize_money(tot)


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
    """
    Annual Recurring Revenue = MRR * 12.
    """
    return quantize_money(mrr(db) * Decimal("12"))

