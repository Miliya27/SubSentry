"""
Shared pytest configuration – installs one shared SQLite in-memory database
for all test files by using StaticPool so every session reuses the same
single connection (avoids the "each :memory: URL = new empty DB" trap).
"""
from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.session import Base, get_db
from app.main import app

# ---------------------------------------------------------------------------
# One shared connection; StaticPool forces all sessions to reuse it.
# ---------------------------------------------------------------------------
_ENGINE = create_engine(
    "sqlite://",                         # same as :memory: but no file
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,                # single connection shared across threads
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_ENGINE)


def _get_test_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# Install the override at module import time (pytest loads conftest first).
app.dependency_overrides[get_db] = _get_test_db


# ---------------------------------------------------------------------------
# Per-test schema isolation: drop + recreate before each function
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
def db_tables():
    import app.models.models  # noqa: F401  – ensure metadata is populated
    Base.metadata.drop_all(bind=_ENGINE)
    Base.metadata.create_all(bind=_ENGINE)
    yield
    Base.metadata.drop_all(bind=_ENGINE)
