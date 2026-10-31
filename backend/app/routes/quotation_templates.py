"""
Quotation Template routes.
Admin/staff only.
Templates CRUD with lines and validity_days.
"""
from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import AdminOrStaffDep, DbDep
from app.models.models import Customer, QuotationStatusEnum, QuotationTemplate, QuotationTemplateLine
from app.schemas.template import (
    CreateTemplateRequest,
    QuotationTemplateOut,
    UpdateTemplateRequest,
)
from app.services.pricing import calculate_line_total

router = APIRouter(tags=["quotation-templates"])


def _not_found(msg: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"success": False, "error": {"code": "NOT_FOUND", "message": msg, "details": None}},
    )


@router.get("/quotation-templates")
def list_quotation_templates(
    _admin_or_staff: AdminOrStaffDep,
    db: DbDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    q: Annotated[Optional[str], Query(max_length=100)] = None,
    customer_id: Annotated[Optional[int], Query()] = None,
    status_filter: Annotated[Optional[str], Query(alias="status")] = None,
):
    query = db.query(QuotationTemplate)
    if q:
        query = query.filter(QuotationTemplate.name.ilike(f"%{q}%"))
    if customer_id is not None:
        query = query.filter(QuotationTemplate.customer_id == customer_id)
    if status_filter:
        try:
            st = QuotationStatusEnum(status_filter)
            query = query.filter(QuotationTemplate.status == st)
        except ValueError:
            pass

    total = query.count()
    templates = (
        query.order_by(QuotationTemplate.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "success": True,
        "data": [QuotationTemplateOut.model_validate(t) for t in templates],
        "message": "OK",
        "meta": {"page": page, "page_size": page_size, "total": total},
    }


@router.post("/quotation-templates", status_code=status.HTTP_201_CREATED)
def create_quotation_template(body: CreateTemplateRequest, _admin_or_staff: AdminOrStaffDep, db: DbDep):
    if body.customer_id is not None:
        cust = db.get(Customer, body.customer_id)
        if not cust:
            raise _not_found(f"Customer {body.customer_id} not found.")

    template = QuotationTemplate(
        name=body.name,
        customer_id=body.customer_id,
        valid_until=body.valid_until,
        validity_days=body.validity_days,
        notes=body.notes,
        status=QuotationStatusEnum.draft,
    )
    db.add(template)
    db.flush()

    for line_req in body.lines:
        lt = calculate_line_total(line_req.unit_price, line_req.quantity, line_req.discount)
        line = QuotationTemplateLine(
            template_id=template.id,
            product_variant_id=line_req.product_variant_id,
            description=line_req.description,
            quantity=line_req.quantity,
            unit_price=line_req.unit_price,
            discount=line_req.discount,
            tax_rule_id=line_req.tax_rule_id,
            line_total=lt,
        )
        db.add(line)

    db.commit()
    db.refresh(template)
    return {"success": True, "data": QuotationTemplateOut.model_validate(template), "message": "OK"}


@router.get("/quotation-templates/{template_id}")
def get_quotation_template(template_id: int, _admin_or_staff: AdminOrStaffDep, db: DbDep):
    template = db.get(QuotationTemplate, template_id)
    if not template:
        raise _not_found(f"Quotation template {template_id} not found.")
    return {"success": True, "data": QuotationTemplateOut.model_validate(template), "message": "OK"}


@router.put("/quotation-templates/{template_id}")
def update_quotation_template(
    template_id: int,
    body: UpdateTemplateRequest,
    _admin_or_staff: AdminOrStaffDep,
    db: DbDep,
):
    template = db.get(QuotationTemplate, template_id)
    if not template:
        raise _not_found(f"Quotation template {template_id} not found.")

    if body.customer_id is not None:
        cust = db.get(Customer, body.customer_id)
        if not cust:
            raise _not_found(f"Customer {body.customer_id} not found.")

    for field in ("name", "customer_id", "status", "valid_until", "validity_days", "notes"):
        val = getattr(body, field)
        if val is not None:
            setattr(template, field, val)

    if body.lines is not None:
        # Replace existing lines
        db.query(QuotationTemplateLine).filter(QuotationTemplateLine.template_id == template.id).delete()
        for line_req in body.lines:
            lt = calculate_line_total(line_req.unit_price, line_req.quantity, line_req.discount)
            line = QuotationTemplateLine(
                template_id=template.id,
                product_variant_id=line_req.product_variant_id,
                description=line_req.description,
                quantity=line_req.quantity,
                unit_price=line_req.unit_price,
                discount=line_req.discount,
                tax_rule_id=line_req.tax_rule_id,
                line_total=lt,
            )
            db.add(line)

    db.commit()
    db.refresh(template)
    return {"success": True, "data": QuotationTemplateOut.model_validate(template), "message": "OK"}


@router.delete("/quotation-templates/{template_id}")
def delete_quotation_template(template_id: int, _admin_or_staff: AdminOrStaffDep, db: DbDep):
    template = db.get(QuotationTemplate, template_id)
    if not template:
        raise _not_found(f"Quotation template {template_id} not found.")

    db.delete(template)
    db.commit()
    return {"success": True, "data": {"message": "Template deleted."}, "message": "OK"}

