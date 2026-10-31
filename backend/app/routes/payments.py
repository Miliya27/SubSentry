"""
Routes for Payments (API Contract 8.12).
Handles listing payments with customer role query filtering.
"""
from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database.session import get_db
from app.models.models import Customer, Payment, PaymentMethodEnum, RoleEnum, User
from app.schemas.payment import PaymentOut

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.get("", response_model=dict)
def list_payments(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    customer_id: Optional[int] = Query(default=None),
    invoice_id: Optional[int] = Query(default=None),
    method: Optional[PaymentMethodEnum] = Query(default=None),
    from_date: Optional[date] = Query(default=None, alias="from"),
    to_date: Optional[date] = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Payment)

    # Customer role sees ONLY own payments (filter in query)
    if current_user.role == RoleEnum.customer:
        customer = db.query(Customer).filter(Customer.user_id == current_user.id).first()
        if not customer:
            return {
                "success": True,
                "data": [],
                "message": "OK",
                "meta": {"page": page, "page_size": page_size, "total": 0},
            }
        query = query.filter(Payment.customer_id == customer.id)
    else:
        if customer_id is not None:
            query = query.filter(Payment.customer_id == customer_id)

    if invoice_id is not None:
        query = query.filter(Payment.invoice_id == invoice_id)

    if method is not None:
        query = query.filter(Payment.method == method)

    if from_date is not None:
        query = query.filter(Payment.payment_date >= from_date)

    if to_date is not None:
        query = query.filter(Payment.payment_date <= to_date)

    total = query.count()
    payments = query.order_by(Payment.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    data = [PaymentOut.model_validate(p).model_dump() for p in payments]

    return {
        "success": True,
        "data": data,
        "message": "OK",
        "meta": {"page": page, "page_size": page_size, "total": total},
    }

