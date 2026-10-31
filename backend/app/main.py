"""
FastAPI application entry point.

Features:
- CORS configured from env
- GET /api/v1/health
- SQLAlchemy table creation on startup
- Global exception handlers returning the standard error envelope
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.database.session import engine
# Import all models so SQLAlchemy's metadata is populated before create_all.
import app.models.models  # noqa: F401
from app.database.session import Base
from app.routes import auth as auth_router
from app.routes import users as users_router
from app.routes import products as products_router
from app.routes import plans as plans_router
from app.routes import taxes as taxes_router
from app.routes import customers as customers_router
from app.routes import quotation_templates as quotation_templates_router
from app.routes import subscriptions as subscriptions_router

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Startup / shutdown lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create all database tables on startup."""
    logger.info("Creating database tables …")
    Base.metadata.create_all(bind=engine)
    logger.info("Database ready.")
    yield
    # Nothing to tear down for SQLite; connection pool closes automatically.


# ---------------------------------------------------------------------------
# App instance
# ---------------------------------------------------------------------------

app = FastAPI(
    title="SubSentry API",
    description="Subscription management backend",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helper – build the standard error envelope dict
# ---------------------------------------------------------------------------

def _error_body(code: str, message: str, details=None) -> dict:
    return {
        "success": False,
        "error": {"code": code, "message": message, "details": details},
    }


# ---------------------------------------------------------------------------
# Global exception handlers
# ---------------------------------------------------------------------------

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """
    When routes raise HTTPException(detail={...}), return that dict directly
    so callers receive our standard error envelope, not FastAPI's
    default {"detail": ...} wrapper.
    """
    if isinstance(exc.detail, dict):
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body("HTTP_ERROR", str(exc.detail)),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Pydantic / query-param validation failures → 422 VALIDATION_ERROR."""
    # exc.errors() may contain non-serializable objects (e.g. ValueError) in
    # the `ctx` field.  Strip ctx and serialize loc/msg/type only.
    details = [
        {
            "field": ".".join(str(p) for p in e.get("loc", [])),
            "message": e.get("msg", ""),
        }
        for e in exc.errors()
    ]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=_error_body(
            code="VALIDATION_ERROR",
            message="Request validation failed.",
            details=details,
        ),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catch-all for unhandled server errors → 500 INTERNAL_ERROR."""
    logger.exception("Unhandled exception on %s %s", request.method, request.url)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=_error_body(
            code="INTERNAL_ERROR",
            message="An unexpected server error occurred.",
        ),
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

app.include_router(auth_router.router, prefix="/api/v1")
app.include_router(users_router.router, prefix="/api/v1")
app.include_router(products_router.router, prefix="/api/v1")
app.include_router(plans_router.router, prefix="/api/v1")
app.include_router(taxes_router.router, prefix="/api/v1")
app.include_router(customers_router.router, prefix="/api/v1")
app.include_router(quotation_templates_router.router, prefix="/api/v1")
app.include_router(subscriptions_router.router, prefix="/api/v1")


@app.get(
    "/api/v1/health",
    tags=["health"],
    summary="Health check",
    response_description="Service is running",
)
def health_check():
    """Public health endpoint – no auth required."""
    return {
        "success": True,
        "data": {
            "status": "ok",
            "version": "1.0.0",
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        },
    }
