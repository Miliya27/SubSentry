"""
Routes for Discounts (API Contract 8.11).
Admin-only CRUD for discount rules.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.database.session import get_db
from app.models.models import DiscountRule, RoleEnum, User
from app.schemas.discount import CreateDiscountRequest, DiscountOut, UpdateDiscountRequest

router = APIRouter(prefix="/discounts", tags=["Discounts"])


def _not_found(msg: str = "Discount rule not found.") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"success": False, "error": {"code": "NOT_FOUND", "message": msg, "details": None}},
    )


@router.get("", response_model=dict)
def list_discounts(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    q: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.admin)),
):
    query = db.query(DiscountRule)
    if is_active is not None:
        query = query.filter(DiscountRule.is_active == is_active)
    if q:
        query = query.filter(DiscountRule.name.ilike(f"%{q.strip()}%"))

    total = query.count()
    items = query.order_by(DiscountRule.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "success": True,
        "data": [DiscountOut.model_validate(item).model_dump() for item in items],
        "message": "OK",
        "meta": {"page": page, "page_size": page_size, "total": total},
    }


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_discount(
    payload: CreateDiscountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.admin)),
):
    rule = DiscountRule(
        name=payload.name,
        type=payload.type,
        value=payload.value,
        min_amount=payload.min_amount or 0.00,
        max_uses=payload.max_uses,
        uses_count=0,
        valid_from=payload.valid_from,
        valid_until=payload.valid_until,
        is_active=payload.is_active if payload.is_active is not None else True,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)

    return {
        "success": True,
        "data": DiscountOut.model_validate(rule).model_dump(),
        "message": "Discount created.",
    }


@router.get("/{id}", response_model=dict)
def get_discount(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.admin)),
):
    rule = db.query(DiscountRule).filter(DiscountRule.id == id).first()
    if not rule:
        raise _not_found()

    return {
        "success": True,
        "data": DiscountOut.model_validate(rule).model_dump(),
        "message": "OK",
    }


@router.put("/{id}", response_model=dict)
def update_discount(
    id: int,
    payload: UpdateDiscountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.admin)),
):
    rule = db.query(DiscountRule).filter(DiscountRule.id == id).first()
    if not rule:
        raise _not_found()

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(rule, k, v)

    db.commit()
    db.refresh(rule)

    return {
        "success": True,
        "data": DiscountOut.model_validate(rule).model_dump(),
        "message": "Discount updated.",
    }


@router.delete("/{id}", response_model=dict)
def delete_discount(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.admin)),
):
    rule = db.query(DiscountRule).filter(DiscountRule.id == id).first()
    if not rule:
        raise _not_found()

    rule.is_active = False
    db.commit()

    return {
        "success": True,
        "data": {"message": "Discount deactivated."},
        "message": "OK",
    }

