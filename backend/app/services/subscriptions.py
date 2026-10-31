"""
Subscription service:
- Generation of unique number SUB-YYYY-NNNNN with safe collision retry
- Creation with price snapshot and validation (quantity >= min_quantity, plan availability, expiry >= start)
- Template conversion with quotation_valid_until calculation
- Lifecycle service with explicit state machine transition table and plan guards
- Response construction using pricing.py totals
"""
from __future__ import annotations

import calendar
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Optional

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.models import (
    BillingFrequencyEnum,
    Customer,
    Plan,
    ProductVariant,
    QuotationTemplate,
    Subscription,
    SubscriptionLine,
    SubscriptionStatusEnum,
    TaxRule,
)
from app.schemas.subscription import (
    CreateSubscriptionLineRequest,
    CreateSubscriptionRequest,
    SubscriptionLineOut,
    SubscriptionOut,
)
from app.services.pricing import (
    calculate_line_total,
    calculate_subscription_totals,
    money_str,
    unit_price,
)


def _business_rule(msg: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"success": False, "error": {"code": "BUSINESS_RULE", "message": msg, "details": None}},
    )


def _validation_error(msg: str, field: str = "quantity") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": msg,
                "details": [{"field": field, "message": msg}],
            },
        },
    )


def _not_found(msg: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"success": False, "error": {"code": "NOT_FOUND", "message": msg, "details": None}},
    )


# ---------------------------------------------------------------------------
# Subscription Number Generator
# ---------------------------------------------------------------------------

def generate_subscription_number(db: Session, year: int | None = None, offset: int = 0) -> str:
    """
    Generate unique identifier in SUB-YYYY-NNNNN format.
    Safely increments based on current max in DB.
    """
    if year is None:
        year = datetime.now(timezone.utc).year
    prefix = f"SUB-{year}-"
    latest = (
        db.query(Subscription.subscription_number)
        .filter(Subscription.subscription_number.like(f"{prefix}%"))
        .order_by(Subscription.subscription_number.desc())
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


# ---------------------------------------------------------------------------
# Totals / Schema Builder
# ---------------------------------------------------------------------------

def build_subscription_out(sub: Subscription, db: Session) -> SubscriptionOut:
    """
    Build SubscriptionOut with line totals and header totals from pricing.py.
    """
    tax_rule_ids = {line.tax_rule_id for line in sub.lines if line.tax_rule_id is not None}
    tax_rules_map: dict[int, TaxRule] = {}
    if tax_rule_ids:
        rules = db.query(TaxRule).filter(TaxRule.id.in_(tax_rule_ids)).all()
        tax_rules_map = {r.id: r for r in rules}

    subtotal, tax_amount, total = calculate_subscription_totals(sub.lines, tax_rules_map)

    lines_out = [
        SubscriptionLineOut(
            id=line.id,
            subscription_id=line.subscription_id,
            product_variant_id=line.product_variant_id,
            quantity=money_str(Decimal(str(line.quantity))),
            unit_price=money_str(Decimal(str(line.unit_price))),
            discount=money_str(Decimal(str(line.discount))),
            tax_rule_id=line.tax_rule_id,
            line_total=money_str(line.line_total),
        )
        for line in sub.lines
    ]

    return SubscriptionOut(
        id=sub.id,
        subscription_number=sub.subscription_number,
        customer_id=sub.customer_id,
        plan_id=sub.plan_id,
        product_variant_id=sub.product_variant_id,
        status=sub.status.value if hasattr(sub.status, "value") else str(sub.status),
        start_date=sub.start_date,
        expiry_date=sub.expiry_date,
        payment_terms_days=sub.payment_terms_days,
        trial_end_date=sub.trial_end_date,
        next_billing_date=sub.next_billing_date,
        quotation_valid_until=sub.quotation_valid_until,
        cancelled_at=sub.cancelled_at,
        created_at=sub.created_at,
        lines=lines_out,
        subtotal=money_str(subtotal),
        tax_amount=money_str(tax_amount),
        total=money_str(total),
    )


# ---------------------------------------------------------------------------
# Validation Helpers
# ---------------------------------------------------------------------------

def validate_plan_availability(plan: Plan, start_date: date) -> None:
    if not plan.is_active:
        raise _business_rule(f"Plan {plan.id} is inactive.")
    if plan.available_from and start_date < plan.available_from:
        raise _business_rule(f"Plan is not available on {start_date} (available from {plan.available_from}).")
    if plan.available_until and start_date > plan.available_until:
        raise _business_rule(f"Plan is not available on {start_date} (available until {plan.available_until}).")


# ---------------------------------------------------------------------------
# Subscription Creation
# ---------------------------------------------------------------------------

def create_subscription(
    db: Session,
    customer_id: int,
    plan_id: int,
    start_date: date,
    expiry_date: Optional[date],
    payment_terms_days: int,
    lines_data: list[CreateSubscriptionLineRequest],
    product_variant_id: Optional[int] = None,
    quotation_valid_until: Optional[date] = None,
) -> Subscription:
    customer = db.get(Customer, customer_id)
    if not customer:
        raise _not_found(f"Customer {customer_id} not found.")

    plan = db.get(Plan, plan_id)
    if not plan:
        raise _not_found(f"Plan {plan_id} not found.")

    validate_plan_availability(plan, start_date)

    if expiry_date is not None and expiry_date < start_date:
        raise _validation_error("expiry_date must be on or after start_date.", field="expiry_date")

    # Header variant validation
    if product_variant_id is not None:
        pv = db.get(ProductVariant, product_variant_id)
        if not pv:
            raise _not_found(f"ProductVariant {product_variant_id} not found.")

    # Validate lines
    prepared_lines: list[SubscriptionLine] = []
    for line_in in lines_data:
        if line_in.quantity < plan.min_quantity:
            raise _validation_error(
                f"Quantity {line_in.quantity} cannot be less than plan minimum quantity ({plan.min_quantity}).",
                field="quantity",
            )
        variant: Optional[ProductVariant] = None
        if line_in.product_variant_id is not None:
            variant = db.get(ProductVariant, line_in.product_variant_id)
            if not variant:
                raise _not_found(f"ProductVariant {line_in.product_variant_id} not found.")

        if line_in.tax_rule_id is not None:
            tax = db.get(TaxRule, line_in.tax_rule_id)
            if not tax:
                raise _not_found(f"TaxRule {line_in.tax_rule_id} not found.")

        # Snapshot unit_price using pricing.py
        price_snapshot = unit_price(plan, variant)
        sub_line = SubscriptionLine(
            product_variant_id=line_in.product_variant_id,
            quantity=line_in.quantity,
            unit_price=price_snapshot,
            discount=line_in.discount,
            tax_rule_id=line_in.tax_rule_id,
        )
        prepared_lines.append(sub_line)

    # Retry loop on subscription_number collision
    max_retries = 5
    for attempt in range(max_retries):
        try:
            sub_num = generate_subscription_number(db, offset=attempt)
            subscription = Subscription(
                subscription_number=sub_num,
                customer_id=customer_id,
                plan_id=plan_id,
                product_variant_id=product_variant_id,
                status=SubscriptionStatusEnum.draft,
                start_date=start_date,
                expiry_date=expiry_date,
                payment_terms_days=payment_terms_days,
                quotation_valid_until=quotation_valid_until,
            )
            db.add(subscription)
            db.flush()

            for line in prepared_lines:
                line.subscription_id = subscription.id
                db.add(line)

            db.commit()
            db.refresh(subscription)
            return subscription
        except IntegrityError:
            db.rollback()
            if attempt == max_retries - 1:
                raise _business_rule("Failed to generate a unique subscription number. Please retry.")

    raise _business_rule("Failed to create subscription.")


def create_subscription_from_template(
    db: Session,
    template_id: int,
    customer_id: int,
    plan_id: int,
    start_date: date,
    expiry_date: Optional[date] = None,
    payment_terms_days: int = 0,
) -> Subscription:
    template = db.get(QuotationTemplate, template_id)
    if not template:
        raise _not_found(f"QuotationTemplate {template_id} not found.")

    customer = db.get(Customer, customer_id)
    if not customer:
        raise _not_found(f"Customer {customer_id} not found.")

    plan = db.get(Plan, plan_id)
    if not plan:
        raise _not_found(f"Plan {plan_id} not found.")

    if not template.lines:
        raise _business_rule("Template has no lines.")

    # quotation_valid_until = created date + template validity_days
    validity_days = template.validity_days or 30
    quotation_valid_until = date.today() + timedelta(days=validity_days)

    lines_data: list[CreateSubscriptionLineRequest] = [
        CreateSubscriptionLineRequest(
            product_variant_id=t_line.product_variant_id,
            quantity=t_line.quantity,
            discount=t_line.discount,
            tax_rule_id=t_line.tax_rule_id,
        )
        for t_line in template.lines
    ]

    # Use first line's variant as default header variant if template lines exist
    header_variant = template.lines[0].product_variant_id if template.lines else None

    return create_subscription(
        db=db,
        customer_id=customer_id,
        plan_id=plan_id,
        start_date=start_date,
        expiry_date=expiry_date,
        payment_terms_days=payment_terms_days,
        lines_data=lines_data,
        product_variant_id=header_variant,
        quotation_valid_until=quotation_valid_until,
    )


# ---------------------------------------------------------------------------
# Lifecycle State Machine
# ---------------------------------------------------------------------------

LIFECYCLE_TRANSITIONS: dict[str, list[SubscriptionStatusEnum]] = {
    "send_quotation": [SubscriptionStatusEnum.draft],
    "confirm": [SubscriptionStatusEnum.quotation],
    "activate": [SubscriptionStatusEnum.confirmed],
    "pause": [SubscriptionStatusEnum.active],
    "resume": [SubscriptionStatusEnum.paused],
    "renew": [SubscriptionStatusEnum.active],
    "close": [SubscriptionStatusEnum.active, SubscriptionStatusEnum.paused],
}


def extend_expiry_date(current_expiry: date, frequency: BillingFrequencyEnum) -> date:
    """Extend expiry date by one billing frequency period."""
    if frequency == BillingFrequencyEnum.daily:
        return current_expiry + timedelta(days=1)
    elif frequency == BillingFrequencyEnum.weekly:
        return current_expiry + timedelta(weeks=1)
    elif frequency == BillingFrequencyEnum.monthly:
        year = current_expiry.year + (current_expiry.month // 12)
        month = (current_expiry.month % 12) + 1
        day = min(current_expiry.day, calendar.monthrange(year, month)[1])
        return date(year, month, day)
    elif frequency == BillingFrequencyEnum.yearly:
        try:
            return date(current_expiry.year + 1, current_expiry.month, current_expiry.day)
        except ValueError:
            return date(current_expiry.year + 1, 2, 28)
    return current_expiry + timedelta(days=30)


class SubscriptionLifecycle:
    @classmethod
    def transition(cls, subscription: Subscription, action: str, db: Session) -> Subscription:
        allowed = LIFECYCLE_TRANSITIONS.get(action)
        if not allowed or subscription.status not in allowed:
            raise _business_rule(
                f"Cannot perform '{action}' on subscription in '{subscription.status.value}' status."
            )

        plan = subscription.plan

        if action == "send_quotation":
            subscription.status = SubscriptionStatusEnum.quotation

        elif action == "confirm":
            subscription.status = SubscriptionStatusEnum.confirmed

        elif action == "activate":
            subscription.status = SubscriptionStatusEnum.active
            # First period is due at start_date
            subscription.next_billing_date = subscription.start_date

        elif action == "pause":
            if not plan.allow_pause:
                raise _business_rule("Plan does not allow pausing.")
            subscription.status = SubscriptionStatusEnum.paused

        elif action == "resume":
            if not plan.allow_pause:
                raise _business_rule("Plan does not allow pausing/resuming.")
            subscription.status = SubscriptionStatusEnum.active

        elif action == "renew":
            if not plan.allow_renewal:
                raise _business_rule("Plan does not allow renewal.")
            base_date = subscription.expiry_date or subscription.start_date
            subscription.expiry_date = extend_expiry_date(base_date, plan.billing_frequency)

        elif action == "close":
            today = date.today()
            # Early close only allowed if plan.allow_early_close is True OR reached expiry
            is_at_or_after_expiry = subscription.expiry_date and today >= subscription.expiry_date
            if not plan.allow_early_close and not is_at_or_after_expiry:
                raise _business_rule("Plan does not allow early close before expiry.")
            subscription.status = SubscriptionStatusEnum.closed
            subscription.cancelled_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(subscription)
        return subscription

