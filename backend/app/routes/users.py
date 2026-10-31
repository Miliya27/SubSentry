"""
User management routes: list users, create staff.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import AdminDep, CurrentUserDep, DbDep
from app.core.security import hash_password
from app.models.models import Customer, RoleEnum, User
from app.schemas.user import CreateStaffRequest, UserOut

router = APIRouter(prefix="/users", tags=["users"])


def _conflict(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={"success": False, "error": {"code": "CONFLICT", "message": message, "details": None}},
    )


# ---------------------------------------------------------------------------
# POST /users/staff – admin only
# ---------------------------------------------------------------------------

@router.post("/staff", status_code=status.HTTP_201_CREATED)
def create_staff(body: CreateStaffRequest, _admin: AdminDep, db: DbDep):
    """Admin only. Creates a staff user account."""
    if db.query(User).filter(User.email == body.email).first():
        raise _conflict("An account with this email address already exists.")

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        phone=body.phone,
        role=RoleEnum.staff,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "data": UserOut.model_validate(user),
        "message": "Staff user created.",
    }


# ---------------------------------------------------------------------------
# GET /users – admin only, paginated
# ---------------------------------------------------------------------------

@router.get("/")
def list_users(
    _admin: AdminDep,
    db: DbDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    role: Annotated[str | None, Query()] = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
):
    """Admin only. List all users with optional role/search filters."""
    query = db.query(User)
    if role:
        try:
            role_enum = RoleEnum(role)
            query = query.filter(User.role == role_enum)
        except ValueError:
            pass  # unknown role → return empty
    if q:
        like = f"%{q}%"
        query = query.filter(
            (User.email.ilike(like)) | (User.full_name.ilike(like))
        )

    total = query.count()
    users = query.offset((page - 1) * page_size).limit(page_size).all()

    return {
        "success": True,
        "data": [UserOut.model_validate(u) for u in users],
        "message": "OK",
        "meta": {"page": page, "page_size": page_size, "total": total},
    }


# ---------------------------------------------------------------------------
# GET /users/me – any authenticated user
# (Declared here as well so the /users prefix works; auth.py /auth/me also works)
# ---------------------------------------------------------------------------

@router.get("/me")
def get_me(current_user: CurrentUserDep):
    return {
        "success": True,
        "data": UserOut.model_validate(current_user),
        "message": "OK",
    }
