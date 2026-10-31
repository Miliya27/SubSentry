"""
Idempotent seed script. Run from the backend/ directory:

    python scripts/seed.py

Re-running is safe – existing rows are skipped via get-or-create logic.
"""
from __future__ import annotations

import sys
import os
from decimal import Decimal

# Allow importing app modules when run as a script from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session

from app.database.session import SessionLocal, engine, Base
from app.models.models import (
    User,
    Customer,
    Product,
    ProductVariant,
    Plan,
    TaxRule,
    RoleEnum,
    BillingFrequencyEnum,
    TaxAppliesToEnum,
)
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


# ---------------------------------------------------------------------------
# Seed data definitions
# ---------------------------------------------------------------------------

USERS = [
    {
        "email": "admin@subsentry.com",
        "password": "Admin@1234",
        "full_name": "Super Admin",
        "phone": "+910000000001",
        "role": RoleEnum.admin,
    },
    {
        "email": "staff@subsentry.com",
        "password": "Staff@1234",
        "full_name": "Staff User",
        "phone": "+910000000002",
        "role": RoleEnum.staff,
    },
    {
        "email": "customer@subsentry.com",
        "password": "Customer@1234",
        "full_name": "Demo Customer",
        "phone": "+910000000003",
        "role": RoleEnum.customer,
    },
]

PRODUCTS = [
    {
        "name": "ERP Software License",
        "product_type": "software",
        "sales_price": Decimal("2000.00"),
        "cost_price": Decimal("0.00"),
        "description": "Enterprise resource planning software subscription",
        "unit": "license",
        "hsn_code": "998314",
        "notes": "Standard ERP product with variants",
        "variants": [
            {
                "attribute": "Edition",
                "value": "Standard",
                "extra_price": Decimal("0.00"),
                "sku": "ERP-STD-001",
            },
            {
                "attribute": "Brand",
                "value": "Odoo",
                # Odoo brand costs +560 over sales_price
                "extra_price": Decimal("560.00"),
                "sku": "ERP-ODOO-001",
            },
        ],
    },
    {
        "name": "CRM Module",
        "product_type": "addon",
        "sales_price": Decimal("999.00"),
        "cost_price": Decimal("0.00"),
        "description": "Customer relationship management add-on",
        "unit": "module",
        "hsn_code": "998315",
        "notes": "CRM add-on for ERP",
        "variants": [
            {
                "attribute": "Tier",
                "value": "Basic",
                "extra_price": Decimal("0.00"),
                "sku": "CRM-BASIC-001",
            },
        ],
    },
]

PLANS = [
    {
        "name": "Monthly Plan",
        "billing_frequency": BillingFrequencyEnum.monthly,
        "price": Decimal("2999.00"),
        "trial_days": 14,
        "min_quantity": 1,
        "allow_early_close": True,
        "allow_pause": True,
        "allow_renewal": True,
    },
    {
        "name": "Yearly Plan",
        "billing_frequency": BillingFrequencyEnum.yearly,
        "price": Decimal("29999.00"),
        "trial_days": 30,
        "min_quantity": 1,
        "allow_early_close": True,
        "allow_pause": True,
        "allow_renewal": True,
    },
    {
        "name": "Weekly Plan",
        "billing_frequency": BillingFrequencyEnum.weekly,
        "price": Decimal("799.00"),
        "trial_days": 7,
        "min_quantity": 1,
        "allow_early_close": True,
        "allow_pause": True,
        "allow_renewal": True,
    },
]

TAX_RULES = [
    {
        "name": "GST 18%",
        "rate_percent": Decimal("18.00"),
        "is_default": True,
        "is_active": True,
        "applies_to": TaxAppliesToEnum.all,
        "hsn_code": None,
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_or_create_user(db: Session, data: dict) -> tuple[User, bool]:
    """Return (user, created). created=True if a new row was inserted."""
    existing = db.query(User).filter(User.email == data["email"]).first()
    if existing:
        return existing, False
    user = User(
        email=data["email"],
        hashed_password=hash_password(data["password"]),
        full_name=data["full_name"],
        phone=data["phone"],
        role=data["role"],
        is_active=True,
    )
    db.add(user)
    db.flush()  # get id before committing
    return user, True


def get_or_create_customer(db: Session, user: User) -> tuple[Customer, bool]:
    existing = db.query(Customer).filter(Customer.user_id == user.id).first()
    if existing:
        return existing, False
    customer = Customer(user_id=user.id)
    db.add(customer)
    db.flush()
    return customer, True


def get_or_create_product(db: Session, data: dict) -> tuple[Product, bool]:
    existing = db.query(Product).filter(Product.name == data["name"]).first()
    if existing:
        return existing, False
    product = Product(
        name=data["name"],
        product_type=data["product_type"],
        sales_price=data["sales_price"],
        cost_price=data.get("cost_price", Decimal("0.00")),
        description=data.get("description"),
        unit=data.get("unit"),
        hsn_code=data.get("hsn_code"),
        notes=data.get("notes"),
    )
    db.add(product)
    db.flush()
    return product, True


def get_or_create_variant(db: Session, product: Product, v: dict) -> tuple[ProductVariant, bool]:
    existing = db.query(ProductVariant).filter(
        ProductVariant.product_id == product.id,
        ProductVariant.attribute == v["attribute"],
        ProductVariant.value == v["value"],
    ).first()
    if existing:
        return existing, False
    variant = ProductVariant(
        product_id=product.id,
        attribute=v["attribute"],
        value=v["value"],
        extra_price=v.get("extra_price", Decimal("0.00")),
        sku=v.get("sku"),
    )
    db.add(variant)
    db.flush()
    return variant, True


def get_or_create_plan(db: Session, data: dict) -> tuple[Plan, bool]:
    existing = db.query(Plan).filter(Plan.name == data["name"]).first()
    if existing:
        return existing, False
    plan = Plan(**data)
    db.add(plan)
    db.flush()
    return plan, True


def get_or_create_tax_rule(db: Session, data: dict) -> tuple[TaxRule, bool]:
    existing = db.query(TaxRule).filter(TaxRule.name == data["name"]).first()
    if existing:
        return existing, False
    rule = TaxRule(**data)
    db.add(rule)
    db.flush()
    return rule, True


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def seed():
    # Ensure tables exist (safe to call multiple times)
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()
    try:
        print("-- Users -----------------------------------------------------")
        customer_user: User | None = None
        for u_data in USERS:
            user, created = get_or_create_user(db, u_data)
            status = "CREATED" if created else "EXISTS "
            print(f"  [{status}] {user.role.value:10s} {user.email}  (password: {u_data['password']})")

            # Create Customer profile for the customer role user
            if user.role == RoleEnum.customer:
                customer_user = user
                cust, _ = get_or_create_customer(db, user)

        print("\n-- Products & Variants ---------------------------------------")
        for p_data in PRODUCTS:
            variants = p_data.pop("variants")
            product, created = get_or_create_product(db, p_data)
            p_data["variants"] = variants  # restore for potential reruns
            status = "CREATED" if created else "EXISTS "
            print(f"  [{status}] Product: {product.name}")
            for v in variants:
                variant, v_created = get_or_create_variant(db, product, v)
                v_status = "CREATED" if v_created else "EXISTS "
                print(f"    [{v_status}] Variant: {variant.attribute}={variant.value}  extra_price={variant.extra_price}")

        # Find ERP Software License to associate plans with
        erp_product = db.query(Product).filter(Product.name == "ERP Software License").first()
        erp_product_id = erp_product.id if erp_product else None

        print("\n-- Plans -----------------------------------------------------")
        for p_data in PLANS:
            if erp_product_id and "product_id" not in p_data:
                p_data["product_id"] = erp_product_id
            plan, created = get_or_create_plan(db, p_data)
            status = "CREATED" if created else "EXISTS "
            print(f"  [{status}] {plan.name}  ({plan.billing_frequency.value}) INR {plan.price}")

        print("\n-- Tax Rules -------------------------------------------------")
        for t_data in TAX_RULES:
            rule, created = get_or_create_tax_rule(db, t_data)
            status = "CREATED" if created else "EXISTS "
            print(f"  [{status}] {rule.name}  rate_percent={rule.rate_percent}%  default={rule.is_default}")

        db.commit()
        print("\n[OK] Seed completed successfully.\n")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
