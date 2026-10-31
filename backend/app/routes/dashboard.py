"""
Routes for Dashboard APIs (API Contract 8.13).
Provides business intelligence metrics, customer overview, and upcoming renewals
using pure SQL aggregations and services.finance.
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.database.session import get_db
from app.models.models import (
    Customer,
    Plan,
    RoleEnum,
    Subscription,
    SubscriptionStatusEnum,
    User,
)
from app.schemas.dashboard import (
    CustomerDashboardOut,
    DashboardSummaryOut,
    UpcomingRenewalItem,
)
from app.services.finance import (
    arr,
    customer_financial_metrics,
    mrr,
    outstanding_total,
    overdue_metrics,
    revenue_received,
    total_invoiced,
)
from app.services.pricing import money_str

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _forbidden(msg: str = "Insufficient permissions") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"success": False, "error": {"code": "FORBIDDEN", "message": msg, "details": None}},
    )


@router.get("/summary", response_model=dict)
def get_dashboard_summary(
    from_date: Optional[date] = Query(default=None, alias="from"),
    to_date: Optional[date] = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.admin, RoleEnum.staff])),
):
    """
    Overview summary for admin and staff.
    Uses SQL aggregation; never mixes received revenue and total invoiced.
    """
    active_subs = (
        db.query(func.count(Subscription.id))
        .filter(Subscription.status == SubscriptionStatusEnum.active)
        .scalar()
        or 0
    )

    rev = revenue_received(db, from_date=from_date, to_date=to_date)
    tot_inv = total_invoiced(db, from_date=from_date, to_date=to_date)
    out = outstanding_total(db)
    od_count, od_amount = overdue_metrics(db)
    val_mrr = mrr(db)
    val_arr = arr(db)

    data = {
        "active_subscriptions": active_subs,
        "revenue_received": money_str(rev),
        "total_invoiced": money_str(tot_inv),
        "outstanding": money_str(out),
        "overdue_count": od_count,
        "overdue_amount": money_str(od_amount),
        "mrr": money_str(val_mrr),
        "arr": money_str(val_arr),
    }

    return {
        "success": True,
        "data": DashboardSummaryOut.model_validate(data).model_dump(),
        "message": "OK",
    }


@router.get("/customer", response_model=dict)
def get_customer_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.customer)),
):
    """
    Customer role overview for own account.
    Filtered by customer_id directly in SQL queries.
    """
    customer = db.query(Customer).filter(Customer.user_id == current_user.id).first()
    if not customer:
        raise _forbidden("No customer profile is associated with this account.")

    metrics = customer_financial_metrics(db, customer.id)

    data = {
        "active_subscriptions": metrics["active_subscriptions"],
        "total_invoiced": money_str(metrics["total_invoiced"]),
        "amount_paid": money_str(metrics["amount_paid"]),
        "outstanding": money_str(metrics["outstanding"]),
        "overdue_count": metrics["overdue_count"],
        "next_renewal": metrics["next_renewal"],
    }

    return {
        "success": True,
        "data": CustomerDashboardOut.model_validate(data).model_dump(),
        "message": "OK",
    }


@router.get("/upcoming-renewals", response_model=dict)
def get_upcoming_renewals(
    days: int = Query(default=30, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.admin, RoleEnum.staff])),
):
    """
    Active subscriptions with next_billing_date in the next N days (limit 50).
    """
    today = date.today()
    max_date = today + timedelta(days=days)

    subs = (
        db.query(Subscription)
        .filter(
            Subscription.status == SubscriptionStatusEnum.active,
            Subscription.next_billing_date.isnot(None),
            Subscription.next_billing_date >= today,
            Subscription.next_billing_date <= max_date,
        )
        .order_by(Subscription.next_billing_date.asc())
        .limit(50)
        .all()
    )

    items = []
    for sub in subs:
        cust = sub.customer
        cust_name = (
            cust.company_name
            if cust and cust.company_name
            else (cust.user.full_name if cust and cust.user else f"Customer {sub.customer_id}")
        )
        plan_name = sub.plan.name if sub.plan else "N/A"

        # Calculate sub line total
        sub_tot = sum(
            (Decimal(str(l.unit_price)) * Decimal(str(l.quantity)) for l in sub.lines),
            Decimal("0.00"),
        )
        if not sub.lines and sub.plan:
            sub_tot = Decimal(str(sub.plan.price))

        items.append({
            "subscription_id": sub.id,
            "customer_id": sub.customer_id,
            "customer_name": cust_name,
            "plan_name": plan_name,
            "next_billing_date": str(sub.next_billing_date),
            "total": money_str(sub_tot),
        })

    return {
        "success": True,
        "data": items,
        "message": "OK",
    }

