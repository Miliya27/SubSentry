"""
Pydantic schemas for response/request shapes.
Only the shared envelope + health schemas are defined here in Hour 1;
feature-specific schemas live beside their routes in later stages.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Response envelopes (matches API_CONTRACT.md section 1)
# ---------------------------------------------------------------------------

class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[Any] = None


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail


class SuccessResponse(BaseModel):
    """Generic success wrapper – data can be any JSON-serializable value."""
    success: bool = True
    data: Any


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

class HealthData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: str = "ok"
    version: str = "1.0.0"
    timestamp: datetime


class HealthResponse(BaseModel):
    success: bool = True
    data: HealthData
