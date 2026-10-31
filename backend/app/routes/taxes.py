"""
Tax rule routes.
Reads: any authenticated role.
Writes: admin only.
"""
from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import AdminDep, CurrentUserDep, DbDep
from app.models.models import TaxRule
from app.schemas.tax import CreateTaxRuleRequest, TaxRuleOut, UpdateTaxRuleRequest

router = APIRouter(tags=["taxes"])


def _not_found(msg: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"success": False, "error": {"code": "NOT_FOUND", "message": msg, "details": None}},
    )


@router.get("/taxes")
def list_taxes(
    _user: CurrentUserDep,
    db: DbDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    q: Annotated[Optional[str], Query(max_length=100)] = None,
    is_active: Annotated[Optional[bool], Query()] = None,
    is_default: Annotated[Optional[bool], Query()] = None,
):
    query = db.query(TaxRule)
    if q:
        query = query.filter(TaxRule.name.ilike(f"%{q}%"))
    if is_active is not None:
        query = query.filter(TaxRule.is_active == is_active)
    if is_default is not None:
        query = query.filter(TaxRule.is_default == is_default)

    total = query.count()
    rules = query.order_by(TaxRule.id).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "success": True,
        "data": [TaxRuleOut.model_validate(r) for r in rules],
        "message": "OK",
        "meta": {"page": page, "page_size": page_size, "total": total},
    }


@router.post("/taxes", status_code=status.HTTP_201_CREATED)
def create_tax_rule(body: CreateTaxRuleRequest, _admin: AdminDep, db: DbDep):
    data = body.model_dump(exclude_unset=True)
    data.pop("rate", None)
    if data.get("is_default"):
        db.query(TaxRule).filter(TaxRule.is_default == True).update({"is_default": False})
    rule = TaxRule(**data)
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return {"success": True, "data": TaxRuleOut.model_validate(rule), "message": "OK"}


@router.get("/taxes/{tax_id}")
def get_tax_rule(tax_id: int, _user: CurrentUserDep, db: DbDep):
    rule = db.get(TaxRule, tax_id)
    if not rule:
        raise _not_found(f"Tax rule {tax_id} not found.")
    return {"success": True, "data": TaxRuleOut.model_validate(rule), "message": "OK"}


@router.put("/taxes/{tax_id}")
def update_tax_rule(tax_id: int, body: UpdateTaxRuleRequest, _admin: AdminDep, db: DbDep):
    rule = db.get(TaxRule, tax_id)
    if not rule:
        raise _not_found(f"Tax rule {tax_id} not found.")
    updates = body.model_dump(exclude_none=True)
    updates.pop("rate", None)
    if updates.get("is_default"):
        db.query(TaxRule).filter(TaxRule.id != tax_id, TaxRule.is_default == True).update({"is_default": False})
    for field, value in updates.items():
        setattr(rule, field, value)
    db.commit()
    db.refresh(rule)
    return {"success": True, "data": TaxRuleOut.model_validate(rule), "message": "OK"}


@router.delete("/taxes/{tax_id}")
def delete_tax_rule(tax_id: int, _admin: AdminDep, db: DbDep):
    rule = db.get(TaxRule, tax_id)
    if not rule:
        raise _not_found(f"Tax rule {tax_id} not found.")
    rule.is_active = False
    db.commit()
    return {"success": True, "data": {"message": "Tax rule deactivated."}, "message": "OK"}
