"""
Subscription routes.
- Full lifecycle and management
- Role-scoping: Customers can view only their own subscriptions (filtered at DB query level)
- Single-record GET of someone else's returns 404
- Writes and lifecycle actions restricted to admin/staff
"""
from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import AdminOrStaffDep, CurrentUserDep, DbDep, get_customer_for_user
from app.models.models import (
    Customer,
    ProductVariant,
    RoleEnum,
    Subscription,
    SubscriptionLine,
    SubscriptionStatusEnum,
    TaxRule,
)
from app.schemas.subscription import (
    CreateSubscriptionFromTemplateRequest,
    CreateSubscriptionRequest,
    SubscriptionOut,
    UpdateSubscriptionRequest,
)
from app.services.pricing import unit_price
from app.services.subscriptions import (
    SubscriptionLifecycle,
    build_subscription_out,
    create_subscription,
    create_subscription_from_template,
)

router = APIRouter(tags=["subscriptions"])


def _not_found(msg: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"success": False, "error": {"code": "NOT_FOUND", "message": msg, "details": None}},
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


# ---------------------------------------------------------------------------
# GET /subscriptions (List)
# ---------------------------------------------------------------------------

@router.get("/subscriptions")
def list_subscriptions(
    current_user: CurrentUserDep,
    db: DbDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    status_filter: Annotated[Optional[str], Query(alias="status")] = None,
    customer_id: Annotated[Optional[int], Query()] = None,
    plan_id: Annotated[Optional[int], Query()] = None,
    q: Annotated[Optional[str], Query(max_length=100)] = None,
    sort: Annotated[Optional[str], Query()] = None,
    sort_dir: Annotated[Optional[str], Query()] = "desc",
):
    query = db.query(Subscription)

    # Customer role scoping: filter by customer_id directly in SQL query
    if current_user.role == RoleEnum.customer:
        customer = get_customer_for_user(current_user, db)
        query = query.filter(Subscription.customer_id == customer.id)
    else:
        if customer_id is not None:
            query = query.filter(Subscription.customer_id == customer_id)

    if plan_id is not None:
        query = query.filter(Subscription.plan_id == plan_id)

    if status_filter:
        try:
            st = SubscriptionStatusEnum(status_filter)
            query = query.filter(Subscription.status == st)
        except ValueError:
            pass

    if q:
        query = query.filter(Subscription.subscription_number.ilike(f"%{q}%"))

    order_col = Subscription.id
    if sort and hasattr(Subscription, sort):
        order_col = getattr(Subscription, sort)
    if sort_dir and sort_dir.lower() == "desc":
        order_col = order_col.desc()
    else:
        order_col = order_col.asc()

    total = query.count()
    subs = query.order_by(order_col).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "success": True,
        "data": [build_subscription_out(s, db) for s in subs],
        "message": "OK",
        "meta": {"page": page, "page_size": page_size, "total": total},
    }


# ---------------------------------------------------------------------------
# POST /subscriptions (Create)
# ---------------------------------------------------------------------------

@router.post("/subscriptions", status_code=status.HTTP_201_CREATED)
def create_subscription_endpoint(
    body: CreateSubscriptionRequest,
    _admin_or_staff: AdminOrStaffDep,
    db: DbDep,
):
    sub = create_subscription(
        db=db,
        customer_id=body.customer_id,
        plan_id=body.plan_id,
        start_date=body.start_date,
        expiry_date=body.expiry_date,
        payment_terms_days=body.payment_terms_days,
        lines_data=body.lines,
        product_variant_id=body.product_variant_id,
    )
    return {"success": True, "data": build_subscription_out(sub, db), "message": "OK"}


# ---------------------------------------------------------------------------
# POST /subscriptions/from-template
# ---------------------------------------------------------------------------

@router.post("/subscriptions/from-template", status_code=status.HTTP_201_CREATED)
def create_from_template_endpoint(
    body: CreateSubscriptionFromTemplateRequest,
    _admin_or_staff: AdminOrStaffDep,
    db: DbDep,
):
    sub = create_subscription_from_template(
        db=db,
        template_id=body.template_id,
        customer_id=body.customer_id,
        plan_id=body.plan_id,
        start_date=body.start_date,
        expiry_date=body.expiry_date,
        payment_terms_days=body.payment_terms_days,
    )
    return {"success": True, "data": build_subscription_out(sub, db), "message": "OK"}


# ---------------------------------------------------------------------------
# GET /subscriptions/{id}
# ---------------------------------------------------------------------------

@router.get("/subscriptions/{subscription_id}")
def get_subscription_endpoint(
    subscription_id: int,
    current_user: CurrentUserDep,
    db: DbDep,
):
    sub = db.get(Subscription, subscription_id)
    if not sub:
        raise _not_found(f"Subscription {subscription_id} not found.")

    if current_user.role == RoleEnum.customer:
        customer = get_customer_for_user(current_user, db)
        if sub.customer_id != customer.id:
            # Mask existence of other customers' subscriptions
            raise _not_found(f"Subscription {subscription_id} not found.")

    return {"success": True, "data": build_subscription_out(sub, db), "message": "OK"}


# ---------------------------------------------------------------------------
# PUT /subscriptions/{id} (Draft edit)
# ---------------------------------------------------------------------------

@router.put("/subscriptions/{subscription_id}")
def update_subscription_endpoint(
    subscription_id: int,
    body: UpdateSubscriptionRequest,
    current_user: CurrentUserDep,
    db: DbDep,
):
    sub = db.get(Subscription, subscription_id)
    if not sub:
        raise _not_found(f"Subscription {subscription_id} not found.")

    if current_user.role == RoleEnum.customer:
        customer = get_customer_for_user(current_user, db)
        if sub.customer_id != customer.id:
            raise _not_found(f"Subscription {subscription_id} not found.")

    if sub.status != SubscriptionStatusEnum.draft:
        raise _business_rule("Subscription can only be edited while in draft status.")

    if body.start_date is not None:
        sub.start_date = body.start_date
    if body.expiry_date is not None:
        if body.expiry_date < sub.start_date:
            raise _validation_error("expiry_date must be on or after start_date.", field="expiry_date")
        sub.expiry_date = body.expiry_date
    if body.payment_terms_days is not None:
        sub.payment_terms_days = body.payment_terms_days

    if body.lines is not None:
        plan = sub.plan
        db.query(SubscriptionLine).filter(SubscriptionLine.subscription_id == sub.id).delete()
        for line_in in body.lines:
            if line_in.quantity < plan.min_quantity:
                raise _validation_error(
                    f"Quantity cannot be less than plan min quantity ({plan.min_quantity}).",
                    field="quantity",
                )
            variant = None
            if line_in.product_variant_id is not None:
                variant = db.get(ProductVariant, line_in.product_variant_id)
                if not variant:
                    raise _not_found(f"ProductVariant {line_in.product_variant_id} not found.")
            if line_in.tax_rule_id is not None:
                tax = db.get(TaxRule, line_in.tax_rule_id)
                if not tax:
                    raise _not_found(f"TaxRule {line_in.tax_rule_id} not found.")

            price_snapshot = unit_price(plan, variant)
            sub_line = SubscriptionLine(
                subscription_id=sub.id,
                product_variant_id=line_in.product_variant_id,
                quantity=line_in.quantity,
                unit_price=price_snapshot,
                discount=line_in.discount,
                tax_rule_id=line_in.tax_rule_id,
            )
            db.add(sub_line)

    db.commit()
    db.refresh(sub)
    return {"success": True, "data": build_subscription_out(sub, db), "message": "OK"}


# ---------------------------------------------------------------------------
# Lifecycle Actions (Admin / Staff)
# ---------------------------------------------------------------------------

@router.post("/subscriptions/{subscription_id}/send-quotation")
def send_quotation_endpoint(
    subscription_id: int,
    _admin_or_staff: AdminOrStaffDep,
    db: DbDep,
):
    sub = db.get(Subscription, subscription_id)
    if not sub:
        raise _not_found(f"Subscription {subscription_id} not found.")
    sub = SubscriptionLifecycle.transition(sub, "send_quotation", db)
    return {
        "success": True,
        "data": {"id": sub.id, "status": sub.status.value},
        "message": "Quotation sent.",
    }


@router.post("/subscriptions/{subscription_id}/confirm")
def confirm_subscription_endpoint(
    subscription_id: int,
    _admin_or_staff: AdminOrStaffDep,
    db: DbDep,
):
    sub = db.get(Subscription, subscription_id)
    if not sub:
        raise _not_found(f"Subscription {subscription_id} not found.")
    sub = SubscriptionLifecycle.transition(sub, "confirm", db)
    return {
        "success": True,
        "data": {"id": sub.id, "status": sub.status.value},
        "message": "Subscription confirmed.",
    }


@router.post("/subscriptions/{subscription_id}/activate")
def activate_subscription_endpoint(
    subscription_id: int,
    _admin_or_staff: AdminOrStaffDep,
    db: DbDep,
):
    sub = db.get(Subscription, subscription_id)
    if not sub:
        raise _not_found(f"Subscription {subscription_id} not found.")
    sub = SubscriptionLifecycle.transition(sub, "activate", db)
    return {
        "success": True,
        "data": {
            "id": sub.id,
            "status": sub.status.value,
            "next_billing_date": sub.next_billing_date,
        },
        "message": "Subscription activated.",
    }


@router.post("/subscriptions/{subscription_id}/pause")
def pause_subscription_endpoint(
    subscription_id: int,
    _admin_or_staff: AdminOrStaffDep,
    db: DbDep,
):
    sub = db.get(Subscription, subscription_id)
    if not sub:
        raise _not_found(f"Subscription {subscription_id} not found.")
    sub = SubscriptionLifecycle.transition(sub, "pause", db)
    return {
        "success": True,
        "data": {"id": sub.id, "status": sub.status.value},
        "message": "Subscription paused.",
    }


@router.post("/subscriptions/{subscription_id}/resume")
def resume_subscription_endpoint(
    subscription_id: int,
    _admin_or_staff: AdminOrStaffDep,
    db: DbDep,
):
    sub = db.get(Subscription, subscription_id)
    if not sub:
        raise _not_found(f"Subscription {subscription_id} not found.")
    sub = SubscriptionLifecycle.transition(sub, "resume", db)
    return {
        "success": True,
        "data": {"id": sub.id, "status": sub.status.value},
        "message": "Subscription resumed.",
    }


@router.post("/subscriptions/{subscription_id}/renew")
def renew_subscription_endpoint(
    subscription_id: int,
    _admin_or_staff: AdminOrStaffDep,
    db: DbDep,
):
    sub = db.get(Subscription, subscription_id)
    if not sub:
        raise _not_found(f"Subscription {subscription_id} not found.")
    sub = SubscriptionLifecycle.transition(sub, "renew", db)
    return {
        "success": True,
        "data": {
            "id": sub.id,
            "status": sub.status.value,
            "expiry_date": sub.expiry_date,
        },
        "message": "Subscription renewed.",
    }


@router.post("/subscriptions/{subscription_id}/close")
def close_subscription_endpoint(
    subscription_id: int,
    _admin_or_staff: AdminOrStaffDep,
    db: DbDep,
):
    sub = db.get(Subscription, subscription_id)
    if not sub:
        raise _not_found(f"Subscription {subscription_id} not found.")
    sub = SubscriptionLifecycle.transition(sub, "close", db)
    return {
        "success": True,
        "data": {
            "id": sub.id,
            "status": sub.status.value,
            "cancelled_at": sub.cancelled_at,
        },
        "message": "Subscription closed.",
    }

