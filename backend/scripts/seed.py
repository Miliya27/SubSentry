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
    BillingCycleEnum,
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
        "description": "Enterprise resource planning software subscription",
        "unit": "license",
        "hsn_code": "998314",
        "variants": [
            {
                "name": "Standard Edition",
                "brand": None,
                "sku": "ERP-STD-001",
                "price_override": Decimal("0.00"),
                "attributes": {"edition": "standard"},
            },
            {
                "name": "Odoo Edition",
                "brand": "Odoo",
                "sku": "ERP-ODOO-001",
                # Odoo brand variant costs +560 over base plan price
                "price_override": Decimal("560.00"),
                "attributes": {"edition": "odoo", "brand": "Odoo"},
            },
        ],
    },
    {
        "name": "CRM Module",
        "description": "Customer relationship management add-on",
        "unit": "module",
        "hsn_code": "998315",
        "variants": [
            {
                "name": "Basic CRM",
                "brand": None,
                "sku": "CRM-BASIC-001",
                "price_override": Decimal("0.00"),
                "attributes": {"tier": "basic"},
            },
        ],
    },
]

PLANS = [
    {
        "name": "Monthly Plan",
        "billing_cycle": BillingCycleEnum.monthly,
        "price": Decimal("2999.00"),
        "trial_days": 14,
    },
    {
        "name": "Yearly Plan",
        "billing_cycle": BillingCycleEnum.yearly,
        "price": Decimal("29999.00"),
        "trial_days": 30,
    },
    {
        "name": "Weekly Plan",
        "billing_cycle": BillingCycleEnum.weekly,
        "price": Decimal("799.00"),
        "trial_days": 7,
    },
]

TAX_RULES = [
    {
        "name": "GST 18%",
        "rate": Decimal("18.00"),
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
        description=data["description"],
        unit=data["unit"],
        hsn_code=data["hsn_code"],
    )
    db.add(product)
    db.flush()
    return product, True


def get_or_create_variant(db: Session, product: Product, v: dict) -> tuple[ProductVariant, bool]:
    existing = db.query(ProductVariant).filter(ProductVariant.sku == v["sku"]).first()
    if existing:
        return existing, False
    variant = ProductVariant(
        product_id=product.id,
        name=v["name"],
        brand=v.get("brand"),
        sku=v["sku"],
        price_override=v["price_override"],
        attributes=v.get("attributes"),
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
        print("── Users ─────────────────────────────────────────────────────")
        customer_user: User | None = None
        for u_data in USERS:
            user, created = get_or_create_user(db, u_data)
            status = "CREATED" if created else "EXISTS "
            print(f"  [{status}] {user.role.value:10s} {user.email}  (password: {u_data['password']})")

            # Create Customer profile for the customer role user
            if user.role == RoleEnum.customer:
                customer_user = user
                cust, _ = get_or_create_customer(db, user)

        print("\n── Products & Variants ───────────────────────────────────────")
        for p_data in PRODUCTS:
            variants = p_data.pop("variants")
            product, created = get_or_create_product(db, p_data)
            p_data["variants"] = variants  # restore for potential reruns
            status = "CREATED" if created else "EXISTS "
            print(f"  [{status}] Product: {product.name}")
            for v in variants:
                variant, v_created = get_or_create_variant(db, product, v)
                v_status = "CREATED" if v_created else "EXISTS "
                print(f"    [{v_status}] Variant: {variant.name}  price_override={variant.price_override}")

        print("\n── Plans ─────────────────────────────────────────────────────")
        for p_data in PLANS:
            plan, created = get_or_create_plan(db, p_data)
            status = "CREATED" if created else "EXISTS "
            print(f"  [{status}] {plan.name}  ({plan.billing_cycle.value}) ₹{plan.price}")

        print("\n── Tax Rules ─────────────────────────────────────────────────")
        for t_data in TAX_RULES:
            rule, created = get_or_create_tax_rule(db, t_data)
            status = "CREATED" if created else "EXISTS "
            print(f"  [{status}] {rule.name}  rate={rule.rate}%")

        db.commit()
        print("\n✓ Seed completed successfully.\n")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
