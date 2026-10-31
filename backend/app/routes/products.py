"""
Product and variant routes.
Reads: any authenticated role.
Writes: admin only.

Price endpoint: GET /products/{id}/price?variant_id=
  final_price = product.sales_price + variant.extra_price (or just sales_price if no variant)
"""
from __future__ import annotations

from decimal import Decimal
from typing import Annotated, Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import AdminDep, CurrentUserDep, DbDep
from app.models.models import Plan, Product, ProductVariant, Subscription, SubscriptionStatusEnum
from app.schemas.product import (
    CreateProductRequest,
    CreateVariantRequest,
    PriceResponse,
    ProductOut,
    UpdateProductRequest,
    UpdateVariantRequest,
    VariantOut,
)
from app.services.pricing import calculate_product_price, money_str, quantize_money

router = APIRouter(tags=["products"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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


def _business_rule(msg: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"success": False, "error": {"code": "BUSINESS_RULE", "message": msg, "details": None}},
    )


def _has_active_subscriptions(db, product_id: int) -> bool:
    active_statuses = [
        SubscriptionStatusEnum.active,
        SubscriptionStatusEnum.confirmed,
        SubscriptionStatusEnum.quotation,
        SubscriptionStatusEnum.draft,
    ]
    return db.query(Subscription).filter(
        Subscription.product_variant_id.in_(
            db.query(ProductVariant.id).filter(ProductVariant.product_id == product_id)
        ),
        Subscription.status.in_(active_statuses),
    ).first() is not None


# ---------------------------------------------------------------------------
# Products CRUD
# ---------------------------------------------------------------------------

@router.get("/products")
def list_products(
    _user: CurrentUserDep,
    db: DbDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    q: Annotated[Optional[str], Query(max_length=100)] = None,
    is_active: Annotated[Optional[bool], Query()] = None,
):
    query = db.query(Product)
    if q:
        query = query.filter(Product.name.ilike(f"%{q}%"))
    if is_active is not None:
        query = query.filter(Product.is_active == is_active)
    total = query.count()
    products = query.order_by(Product.id).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "success": True,
        "data": [ProductOut.model_validate(p) for p in products],
        "message": "OK",
        "meta": {"page": page, "page_size": page_size, "total": total},
    }


@router.post("/products", status_code=status.HTTP_201_CREATED)
def create_product(body: CreateProductRequest, _admin: AdminDep, db: DbDep):
    product = Product(**body.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return {"success": True, "data": ProductOut.model_validate(product), "message": "OK"}


@router.get("/products/{product_id}")
def get_product(product_id: int, _user: CurrentUserDep, db: DbDep):
    product = db.get(Product, product_id)
    if not product:
        raise _not_found(f"Product {product_id} not found.")
    return {"success": True, "data": ProductOut.model_validate(product), "message": "OK"}


@router.put("/products/{product_id}")
def update_product(product_id: int, body: UpdateProductRequest, _admin: AdminDep, db: DbDep):
    product = db.get(Product, product_id)
    if not product:
        raise _not_found(f"Product {product_id} not found.")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return {"success": True, "data": ProductOut.model_validate(product), "message": "OK"}


@router.delete("/products/{product_id}")
def delete_product(product_id: int, _admin: AdminDep, db: DbDep):
    product = db.get(Product, product_id)
    if not product:
        raise _not_found(f"Product {product_id} not found.")
    if _has_active_subscriptions(db, product_id):
        raise _business_rule("Cannot deactivate a product with active subscriptions.")
    product.is_active = False
    db.commit()
    return {"success": True, "data": {"message": "Product deactivated."}, "message": "OK"}


# ---------------------------------------------------------------------------
# Price endpoint – no plan required; price = product.sales_price + variant.extra_price
# ---------------------------------------------------------------------------

@router.get("/products/{product_id}/price")
def get_price(
    product_id: int,
    _user: CurrentUserDep,
    db: DbDep,
    variant_id: Annotated[Optional[int], Query()] = None,
):
    product = db.get(Product, product_id)
    if not product:
        raise _not_found(f"Product {product_id} not found.")

    variant: Optional[ProductVariant] = None
    extra = Decimal("0.00")
    if variant_id is not None:
        variant = db.get(ProductVariant, variant_id)
        if not variant:
            raise _not_found(f"Variant {variant_id} not found.")
        if variant.product_id != product_id:
            raise _business_rule("Variant does not belong to this product.")
        extra = Decimal(str(variant.extra_price))

    sales_price, extra_price, final_price = calculate_product_price(product, variant)

    return {
        "success": True,
        "data": PriceResponse(
            product_id=product_id,
            variant_id=variant_id,
            sales_price=money_str(sales_price),
            extra_price=money_str(extra_price),
            final_price=money_str(final_price),
        ),
        "message": "OK",
    }


# ---------------------------------------------------------------------------
# Variants (nested under /products/{id}/variants)
# ---------------------------------------------------------------------------

@router.get("/products/{product_id}/variants")
def list_variants(product_id: int, _user: CurrentUserDep, db: DbDep):
    product = db.get(Product, product_id)
    if not product:
        raise _not_found(f"Product {product_id} not found.")
    return {
        "success": True,
        "data": [VariantOut.model_validate(v) for v in product.variants],
        "message": "OK",
    }


@router.post("/products/{product_id}/variants", status_code=status.HTTP_201_CREATED)
def create_variant(product_id: int, body: CreateVariantRequest, _admin: AdminDep, db: DbDep):
    product = db.get(Product, product_id)
    if not product:
        raise _not_found(f"Product {product_id} not found.")
    if body.sku:
        if db.query(ProductVariant).filter(ProductVariant.sku == body.sku).first():
            raise _conflict(f"SKU '{body.sku}' is already in use.")
    variant = ProductVariant(product_id=product_id, **body.model_dump())
    db.add(variant)
    db.commit()
    db.refresh(variant)
    return {"success": True, "data": VariantOut.model_validate(variant), "message": "OK"}


# ---------------------------------------------------------------------------
# Variants (standalone /variants/{id})
# ---------------------------------------------------------------------------

@router.get("/variants/{variant_id}")
def get_variant(variant_id: int, _user: CurrentUserDep, db: DbDep):
    variant = db.get(ProductVariant, variant_id)
    if not variant:
        raise _not_found(f"Variant {variant_id} not found.")
    return {"success": True, "data": VariantOut.model_validate(variant), "message": "OK"}


@router.put("/variants/{variant_id}")
def update_variant(variant_id: int, body: UpdateVariantRequest, _admin: AdminDep, db: DbDep):
    variant = db.get(ProductVariant, variant_id)
    if not variant:
        raise _not_found(f"Variant {variant_id} not found.")
    if body.sku is not None and body.sku != variant.sku:
        if db.query(ProductVariant).filter(ProductVariant.sku == body.sku).first():
            raise _conflict(f"SKU '{body.sku}' is already in use.")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(variant, field, value)
    db.commit()
    db.refresh(variant)
    return {"success": True, "data": VariantOut.model_validate(variant), "message": "OK"}


@router.delete("/variants/{variant_id}")
def delete_variant(variant_id: int, _admin: AdminDep, db: DbDep):
    variant = db.get(ProductVariant, variant_id)
    if not variant:
        raise _not_found(f"Variant {variant_id} not found.")
    variant.is_active = False
    db.commit()
    return {"success": True, "data": {"message": "Variant deactivated."}, "message": "OK"}
