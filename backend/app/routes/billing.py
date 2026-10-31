"""
Routes for Billing engine (API Contract 8.8).
Admin-only endpoints to run or preview automated billing.
"""
from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.database.session import get_db
from app.models.models import RoleEnum, User
from app.services.billing import billing_run

router = APIRouter(prefix="/billing", tags=["Billing"])


class BillingRunRequest(BaseModel):
    as_of_date: Optional[date] = None


@router.post("/run", response_model=dict)
def run_billing(
    payload: Optional[BillingRunRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.admin)),
):
    target_date = (payload.as_of_date if payload and payload.as_of_date else date.today())
    result = billing_run(db, as_of_date=target_date, preview=False)

    return {
        "success": True,
        "data": {
            "created": result["created"],
            "skipped": result["skipped"],
            "failed": result["failed"],
            "invoice_ids": result["invoice_ids"],
            "errors": result["errors"],
        },
        "message": "Billing run complete.",
    }


@router.get("/preview", response_model=dict)
def preview_billing(
    as_of: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.admin)),
):
    target_date = as_of or date.today()
    result = billing_run(db, as_of_date=target_date, preview=True)

    return {
        "success": True,
        "data": {
            "would_create": result["would_create"],
            "would_skip": result["would_skip"],
            "subscriptions": result["subscriptions"],
        },
        "message": "OK",
    }

