"""
Routes for Invoices (API Contract 8.9).
Handles listing with customer scoping, invoice detail, confirmation,
cancellation, sending via mailer, and print rendering.
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.database.session import get_db
from app.models.models import (
    Customer,
    DiscountRule,
    Invoice,
    InvoiceLine,
    InvoiceStatusEnum,
    RoleEnum,
    TaxRule,
    User,
)
from app.schemas.invoice import (
    InvoiceDetailOut,
    InvoiceLineOut,
    InvoiceOut,
    InvoicePrintOut,
    PaymentOut,
    TaxBreakdownItem,
)
from app.services.mailer import send_invoice_email
from app.services.pricing import money_str, quantize_money

router = APIRouter(prefix="/invoices", tags=["Invoices"])


def _not_found(msg: str = "Invoice not found.") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"success": False, "error": {"code": "NOT_FOUND", "message": msg, "details": None}},
    )


def _business_rule(msg: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"success": False, "error": {"code": "BUSINESS_RULE", "message": msg, "details": None}},
    )


def _build_invoice_dict(inv: Invoice) -> dict:
    paid = quantize_money(sum((p.amount for p in inv.payments), Decimal("0.00")))
    outstanding = quantize_money(inv.total - paid)
    return {
        "id": inv.id,
        "subscription_id": inv.subscription_id,
        "customer_id": inv.customer_id,
        "invoice_number": inv.invoice_number,
        "status": inv.status.value if hasattr(inv.status, "value") else str(inv.status),
        "issue_date": inv.issue_date,
        "due_date": inv.due_date,
        "period_start": inv.period_start,
        "period_end": inv.period_end,
        "subtotal": money_str(inv.subtotal),
        "tax_amount": money_str(inv.tax_amount),
        "discount_amount": money_str(inv.discount_amount),
        "total": money_str(inv.total),
        "amount_paid": money_str(paid),
        "outstanding": money_str(outstanding),
        "notes": inv.notes,
        "sent_at": inv.sent_at,
        "created_at": inv.created_at,
    }


@router.get("", response_model=dict)
def list_invoices(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: Optional[InvoiceStatusEnum] = Query(default=None),
    customer_id: Optional[int] = Query(default=None),
    subscription_id: Optional[int] = Query(default=None),
    from_date: Optional[date] = Query(default=None, alias="from"),
    to_date: Optional[date] = Query(default=None, alias="to"),
    sort: Optional[str] = Query(default="created_at"),
    sort_dir: Optional[str] = Query(default="desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Invoice)

    # Customer role: view ONLY own invoices (filter at DB query level)
    if current_user.role == RoleEnum.customer:
        customer = db.query(Customer).filter(Customer.user_id == current_user.id).first()
        if not customer:
            return {"success": True, "data": [], "message": "OK", "meta": {"page": page, "page_size": page_size, "total": 0}}
        query = query.filter(Invoice.customer_id == customer.id)
    else:
        if customer_id is not None:
            query = query.filter(Invoice.customer_id == customer_id)

    if subscription_id is not None:
        query = query.filter(Invoice.subscription_id == subscription_id)

    if status is not None:
        query = query.filter(Invoice.status == status)

    if from_date is not None:
        query = query.filter(Invoice.issue_date >= from_date)

    if to_date is not None:
        query = query.filter(Invoice.issue_date <= to_date)

    # Sorting
    sort_col = getattr(Invoice, sort, Invoice.created_at) if sort else Invoice.created_at
    if sort_dir == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    total = query.count()
    invoices = query.offset((page - 1) * page_size).limit(page_size).all()

    data = [_build_invoice_dict(inv) for inv in invoices]

    return {
        "success": True,
        "data": data,
        "message": "OK",
        "meta": {"page": page, "page_size": page_size, "total": total},
    }


@router.get("/{id}", response_model=dict)
def get_invoice(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = db.query(Invoice).filter(Invoice.id == id).first()
    if not invoice:
        raise _not_found()

    # Customer role scoping
    if current_user.role == RoleEnum.customer:
        customer = db.query(Customer).filter(Customer.user_id == current_user.id).first()
        if not customer or invoice.customer_id != customer.id:
            raise _not_found()

    base_dict = _build_invoice_dict(invoice)

    lines_out = []
    for line in invoice.lines:
        lines_out.append({
            "id": line.id,
            "product_variant_id": line.product_variant_id,
            "description": line.description,
            "quantity": money_str(line.quantity),
            "unit_price": money_str(line.unit_price),
            "discount": money_str(line.discount),
            "tax_rule_id": line.tax_rule_id,
            "line_total": money_str(line.line_total),
        })

    payments_out = []
    for p in invoice.payments:
        payments_out.append({
            "id": p.id,
            "invoice_id": p.invoice_id,
            "customer_id": p.customer_id,
            "amount": money_str(p.amount),
            "payment_date": p.payment_date,
            "method": p.method.value if hasattr(p.method, "value") else str(p.method),
            "reference": p.reference,
            "notes": p.notes,
            "created_at": p.created_at,
        })

    base_dict["lines"] = lines_out
    base_dict["payments"] = payments_out

    return {
        "success": True,
        "data": base_dict,
        "message": "OK",
    }


@router.post("/{id}/confirm", response_model=dict)
def confirm_invoice(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.admin, RoleEnum.staff])),
):
    invoice = db.query(Invoice).filter(Invoice.id == id).first()
    if not invoice:
        raise _not_found()

    if invoice.status != InvoiceStatusEnum.draft:
        raise _business_rule("Only draft invoices can be confirmed.")

    # Increment discount usage count for discount rules applied to lines
    for line in invoice.lines:
        if line.discount_rule_id:
            rule = db.query(DiscountRule).filter(DiscountRule.id == line.discount_rule_id).first()
            if rule:
                rule.uses_count += 1

    invoice.status = InvoiceStatusEnum.confirmed
    db.commit()

    return {
        "success": True,
        "data": {"id": invoice.id, "status": "confirmed"},
        "message": "Invoice confirmed.",
    }


@router.post("/{id}/cancel", response_model=dict)
def cancel_invoice(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.admin, RoleEnum.staff])),
):
    invoice = db.query(Invoice).filter(Invoice.id == id).first()
    if not invoice:
        raise _not_found()

    if invoice.status == InvoiceStatusEnum.paid or len(invoice.payments) > 0:
        raise _business_rule("Cannot cancel a paid invoice or an invoice with payments.")

    if invoice.status == InvoiceStatusEnum.cancelled:
        raise _business_rule("Invoice is already cancelled.")

    invoice.status = InvoiceStatusEnum.cancelled
    db.commit()

    return {
        "success": True,
        "data": {"id": invoice.id, "status": "cancelled"},
        "message": "Invoice cancelled.",
    }


@router.post("/{id}/send", response_model=dict)
def send_invoice(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.admin, RoleEnum.staff])),
):
    invoice = db.query(Invoice).filter(Invoice.id == id).first()
    if not invoice:
        raise _not_found()

    if invoice.status == InvoiceStatusEnum.draft:
        raise _business_rule("Invoice is draft — must confirm first.")

    customer = invoice.customer
    if not customer or not customer.user or not customer.user.email:
        raise _business_rule("Customer email not found.")

    email = customer.user.email
    send_invoice_email(to_email=email, invoice_number=invoice.invoice_number, total_amount=money_str(invoice.total))

    invoice.sent_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "success": True,
        "data": {"message": f"Invoice emailed to {email}."},
        "message": "OK",
    }


@router.get("/{id}/print", response_model=dict)
def get_invoice_print_data(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = db.query(Invoice).filter(Invoice.id == id).first()
    if not invoice:
        raise _not_found()

    # Customer role scoping
    if current_user.role == RoleEnum.customer:
        customer = db.query(Customer).filter(Customer.user_id == current_user.id).first()
        if not customer or invoice.customer_id != customer.id:
            raise _not_found()

    inv_dict = _build_invoice_dict(invoice)

    cust = invoice.customer
    customer_dict = {
        "id": cust.id if cust else None,
        "company_name": cust.company_name if cust else None,
        "billing_address": cust.billing_address if cust else None,
        "shipping_address": cust.shipping_address if cust else None,
    }

    lines_out = []
    tax_groups: dict[int | None, dict[str, Any]] = {}

    for line in invoice.lines:
        line_base = quantize_money(line.unit_price * line.quantity)
        taxable = quantize_money(line_base - line.discount)
        tax_amount = quantize_money(line.line_total - taxable)

        lines_out.append({
            "id": line.id,
            "product_variant_id": line.product_variant_id,
            "description": line.description,
            "quantity": money_str(line.quantity),
            "unit_price": money_str(line.unit_price),
            "discount": money_str(line.discount),
            "tax_rule_id": line.tax_rule_id,
            "line_total": money_str(line.line_total),
        })

        # Group by tax rule for tax breakdown
        tid = line.tax_rule_id
        if tid not in tax_groups:
            rule = db.query(TaxRule).filter(TaxRule.id == tid).first() if tid else None
            tax_groups[tid] = {
                "name": rule.name if rule else "No Tax",
                "rate": money_str(rule.rate_percent) if rule else "0.00",
                "taxable_amount": Decimal("0.00"),
                "tax": Decimal("0.00"),
            }
        tax_groups[tid]["taxable_amount"] += taxable
        tax_groups[tid]["tax"] += tax_amount

    tax_breakdown = [
        {
            "name": grp["name"],
            "rate": grp["rate"],
            "taxable_amount": money_str(grp["taxable_amount"]),
            "tax": money_str(grp["tax"]),
        }
        for grp in tax_groups.values()
    ]

    payments_out = []
    for p in invoice.payments:
        payments_out.append({
            "id": p.id,
            "amount": money_str(p.amount),
            "payment_date": p.payment_date,
            "method": p.method.value if hasattr(p.method, "value") else str(p.method),
            "reference": p.reference,
        })

    return {
        "success": True,
        "data": {
            "invoice": inv_dict,
            "customer": customer_dict,
            "lines": lines_out,
            "payments": payments_out,
            "tax_breakdown": tax_breakdown,
        },
        "message": "OK",
    }

