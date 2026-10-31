"""
Security helpers: password hashing and JWT creation/verification.
Hashes are never returned or logged.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ---------------------------------------------------------------------------
# Password
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    """Return a bcrypt hash. Never log or return the result."""
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

def create_access_token(subject: int, role: str) -> str:
    """Create a signed JWT. sub = user id (int as str)."""
    expire = datetime.now(tz=timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload: dict[str, Any] = {
        "sub": str(subject),
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Decode and verify a JWT.
    Raises jose.JWTError on failure (expired, tampered, wrong key).
    """
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


# ---------------------------------------------------------------------------
# Password-reset tokens
# ---------------------------------------------------------------------------

def generate_reset_token() -> tuple[str, str]:
    """
    Returns (raw_token, sha256_hash).
    Store only the hash; send the raw token to the user.
    """
    raw = secrets.token_urlsafe(32)
    digest = hashlib.sha256(raw.encode()).hexdigest()
    return raw, digest


def hash_reset_token(raw: str) -> str:
    """Re-hash a raw token for DB lookup."""
    return hashlib.sha256(raw.encode()).hexdigest()
