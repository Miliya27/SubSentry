"""
Plan routes.
Reads: any authenticated role.
Writes: admin only.
"""
from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import AdminDep, CurrentUserDep, DbDep
from app.models.models import Plan, Product, Subscription, SubscriptionStatusEnum
from app.schemas.plan import CreatePlanRequest, PlanOut, UpdatePlanRequest

router = APIRouter(tags=["plans"])


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


def _has_active_subscriptions_for_plan(db: Session, plan_id: int) -> bool:
    active_statuses = [
        SubscriptionStatusEnum.active,
        SubscriptionStatusEnum.confirmed,
        SubscriptionStatusEnum.quotation,
        SubscriptionStatusEnum.draft,
    ]
    return (
        db.query(Subscription)
        .filter(Subscription.plan_id == plan_id, Subscription.status.in_(active_statuses))
        .first()
        is not None
    )


@router.get("/plans")
def list_plans(
    _user: CurrentUserDep,
    db: DbDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    q: Annotated[Optional[str], Query(max_length=100)] = None,
    billing_frequency: Annotated[Optional[str], Query()] = None,
    product_id: Annotated[Optional[int], Query()] = None,
    is_active: Annotated[Optional[bool], Query()] = None,
):
    query = db.query(Plan)
    if q:
        query = query.filter(Plan.name.ilike(f"%{q}%"))
    if billing_frequency:
        from app.models.models import BillingFrequencyEnum
        try:
            freq_enum = BillingFrequencyEnum(billing_frequency)
            query = query.filter(Plan.billing_frequency == freq_enum)
        except ValueError:
            pass  # unknown value → return empty effectively
    if product_id is not None:
        query = query.filter(Plan.product_id == product_id)
    if is_active is not None:
        query = query.filter(Plan.is_active == is_active)

    total = query.count()
    plans = query.order_by(Plan.id).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "success": True,
        "data": [PlanOut.model_validate(p) for p in plans],
        "message": "OK",
        "meta": {"page": page, "page_size": page_size, "total": total},
    }


@router.post("/plans", status_code=status.HTTP_201_CREATED)
def create_plan(body: CreatePlanRequest, _admin: AdminDep, db: DbDep):
    # Validate product_id exists
    product = db.get(Product, body.product_id)
    if not product:
        raise _not_found(f"Product {body.product_id} not found.")

    data = body.model_dump()
    plan = Plan(**data)
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return {"success": True, "data": PlanOut.model_validate(plan), "message": "OK"}


@router.get("/plans/{plan_id}")
def get_plan(plan_id: int, _user: CurrentUserDep, db: DbDep):
    plan = db.get(Plan, plan_id)
    if not plan:
        raise _not_found(f"Plan {plan_id} not found.")
    return {"success": True, "data": PlanOut.model_validate(plan), "message": "OK"}


@router.put("/plans/{plan_id}")
def update_plan(plan_id: int, body: UpdatePlanRequest, _admin: AdminDep, db: DbDep):
    plan = db.get(Plan, plan_id)
    if not plan:
        raise _not_found(f"Plan {plan_id} not found.")

    updates = body.model_dump(exclude_none=True)

    # If caller supplies only one of the date fields, merge with existing
    af = updates.get("available_from", plan.available_from)
    au = updates.get("available_until", plan.available_until)
    if af and au and au < af:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "success": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "available_until must be on or after available_from.",
                    "details": [{"field": "available_until", "message": "Must be on or after available_from."}],
                },
            },
        )

    if "product_id" in updates:
        product = db.get(Product, updates["product_id"])
        if not product:
            raise _not_found(f"Product {updates['product_id']} not found.")

    for field, value in updates.items():
        setattr(plan, field, value)
    db.commit()
    db.refresh(plan)
    return {"success": True, "data": PlanOut.model_validate(plan), "message": "OK"}


@router.delete("/plans/{plan_id}")
def delete_plan(plan_id: int, _admin: AdminDep, db: DbDep):
    plan = db.get(Plan, plan_id)
    if not plan:
        raise _not_found(f"Plan {plan_id} not found.")
    if _has_active_subscriptions_for_plan(db, plan_id):
        raise _business_rule("Cannot deactivate a plan with active subscriptions.")
    plan.is_active = False
    db.commit()
    return {"success": True, "data": {"message": "Plan deactivated."}, "message": "OK"}
