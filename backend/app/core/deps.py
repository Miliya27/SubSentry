"""
FastAPI dependencies for authentication and role-based access control.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.database.session import get_db
from app.models.models import Customer, RoleEnum, User

bearer_scheme = HTTPBearer(auto_error=False)

# Shared type aliases for Annotated dependencies (FastAPI skill pattern)
DbDep = Annotated[Session, Depends(get_db)]
TokenDep = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]


def _unauthenticated(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"success": False, "error": {"code": "UNAUTHENTICATED", "message": detail, "details": None}},
        headers={"WWW-Authenticate": "Bearer"},
    )


def _forbidden(detail: str = "Insufficient permissions") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"success": False, "error": {"code": "FORBIDDEN", "message": detail, "details": None}},
    )


# ---------------------------------------------------------------------------
# Core user dependency
# ---------------------------------------------------------------------------

def get_current_user(token: TokenDep, db: DbDep) -> User:
    """
    Extract and verify the JWT from the Authorization header.
    Returns the User ORM object. Raises 401 on any failure.
    """
    if token is None or not token.credentials:
        raise _unauthenticated("Missing Bearer token.")

    try:
        payload = decode_access_token(token.credentials)
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise _unauthenticated("Token payload missing subject.")
    except JWTError:
        raise _unauthenticated("Invalid or expired token.")

    user = db.get(User, int(user_id))
    if user is None or not user.is_active:
        raise _unauthenticated("User not found or deactivated.")
    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]


# ---------------------------------------------------------------------------
# Role-enforcement factory
# ---------------------------------------------------------------------------

def require_roles(*roles: str):
    """
    Returns a FastAPI dependency that enforces the caller has one of the
    given roles. Uses get_current_user so 401 fires before 403.
    """
    def checker(current_user: CurrentUserDep) -> User:
        if current_user.role.value not in roles:
            raise _forbidden(
                f"This action requires one of: {', '.join(roles)}."
            )
        return current_user

    return checker


# Convenience aliases used in router declarations
AdminDep = Annotated[User, Depends(require_roles(RoleEnum.admin.value))]
AdminOrStaffDep = Annotated[User, Depends(require_roles(RoleEnum.admin.value, RoleEnum.staff.value))]


# ---------------------------------------------------------------------------
# Customer-scoping helper
# ---------------------------------------------------------------------------

def get_customer_for_user(user: User, db: Session) -> Customer:
    """
    Return the Customer profile linked to a user.
    Raises 403 if the user has no customer profile (i.e. is admin/staff
    calling an endpoint that requires a customer context).
    Used by all customer-facing queries to scope results correctly.
    """
    customer = db.query(Customer).filter(Customer.user_id == user.id).first()
    if customer is None:
        raise _forbidden("No customer profile is associated with this account.")
    return customer
