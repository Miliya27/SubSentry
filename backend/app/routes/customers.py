"""
Customer routes.
Admin/staff have full CRUD.
Customer role may only GET/PUT their own record (PUT limited to addresses).
"""
from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import or_

from app.core.deps import AdminOrStaffDep, CurrentUserDep, DbDep
from app.models.models import Customer, RoleEnum, User
from app.schemas.customer import CreateCustomerRequest, CustomerOut, UpdateCustomerRequest

router = APIRouter(tags=["customers"])


def _not_found(msg: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"success": False, "error": {"code": "NOT_FOUND", "message": msg, "details": None}},
    )


def _conflict(msg: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={"success": False, "error": {"code": "CONFLICT", "message": msg, "details": None}},
    )


def _forbidden(msg: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"success": False, "error": {"code": "FORBIDDEN", "message": msg, "details": None}},
    )


@router.get("/customers")
def list_customers(
    _admin_or_staff: AdminOrStaffDep,
    db: DbDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    q: Annotated[Optional[str], Query(max_length=100)] = None,
    sort: Annotated[Optional[str], Query()] = None,
    sort_dir: Annotated[Optional[str], Query()] = "asc",
):
    query = db.query(Customer).join(Customer.user)
    if q:
        search = f"%{q}%"
        query = query.filter(
            or_(
                Customer.company_name.ilike(search),
                Customer.gstin.ilike(search),
                User.email.ilike(search),
            )
        )

    order_col = Customer.id
    if sort and hasattr(Customer, sort):
        order_col = getattr(Customer, sort)
    if sort_dir and sort_dir.lower() == "desc":
        order_col = order_col.desc()
    else:
        order_col = order_col.asc()

    total = query.count()
    customers = query.order_by(order_col).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "success": True,
        "data": [CustomerOut.model_validate(c) for c in customers],
        "message": "OK",
        "meta": {"page": page, "page_size": page_size, "total": total},
    }


@router.post("/customers", status_code=status.HTTP_201_CREATED)
def create_customer(body: CreateCustomerRequest, _admin_or_staff: AdminOrStaffDep, db: DbDep):
    user = db.get(User, body.user_id)
    if not user:
        raise _not_found(f"User {body.user_id} not found.")

    existing = db.query(Customer).filter(Customer.user_id == body.user_id).first()
    if existing:
        raise _conflict(f"Customer profile already exists for user {body.user_id}.")

    customer = Customer(
        user_id=body.user_id,
        company_name=body.company_name,
        gstin=body.gstin,
        billing_address=body.billing_address,
        shipping_address=body.shipping_address,
        credit_limit=body.credit_limit,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return {"success": True, "data": CustomerOut.model_validate(customer), "message": "OK"}


@router.get("/customers/{customer_id}")
def get_customer(customer_id: int, current_user: CurrentUserDep, db: DbDep):
    customer = db.get(Customer, customer_id)
    if not customer:
        raise _not_found(f"Customer {customer_id} not found.")

    if current_user.role == RoleEnum.customer and customer.user_id != current_user.id:
        raise _forbidden("Access denied to another customer's profile.")

    return {"success": True, "data": CustomerOut.model_validate(customer), "message": "OK"}


@router.put("/customers/{customer_id}")
def update_customer(
    customer_id: int,
    body: UpdateCustomerRequest,
    current_user: CurrentUserDep,
    db: DbDep,
):
    customer = db.get(Customer, customer_id)
    if not customer:
        raise _not_found(f"Customer {customer_id} not found.")

    if current_user.role == RoleEnum.customer:
        if customer.user_id != current_user.id:
            raise _forbidden("Access denied to another customer's profile.")
        # Customers may only update billing_address and shipping_address
        if body.billing_address is not None:
            customer.billing_address = body.billing_address
        if body.shipping_address is not None:
            customer.shipping_address = body.shipping_address
    else:
        # Admin or staff can update all fields
        for field, value in body.model_dump(exclude_none=True).items():
            setattr(customer, field, value)

    db.commit()
    db.refresh(customer)
    return {"success": True, "data": CustomerOut.model_validate(customer), "message": "OK"}


@router.delete("/customers/{customer_id}")
def delete_customer(customer_id: int, _admin_or_staff: AdminOrStaffDep, db: DbDep):
    customer = db.get(Customer, customer_id)
    if not customer:
        raise _not_found(f"Customer {customer_id} not found.")

    db.delete(customer)
    db.commit()
    return {"success": True, "data": {"message": "Customer deleted."}, "message": "OK"}

