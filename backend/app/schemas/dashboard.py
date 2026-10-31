"""
Pydantic schemas for Dashboard APIs (API Contract 8.13).
Money fields serialized as 2-decimal strings.
"""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, ConfigDict


class DashboardSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    active_subscriptions: int
    revenue_received: str
    total_invoiced: str
    outstanding: str
    overdue_count: int
    overdue_amount: str
    mrr: str
    arr: str


class CustomerDashboardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    active_subscriptions: int
    total_invoiced: str
    amount_paid: str
    outstanding: str
    overdue_count: int
    next_renewal: Optional[str] = None


class UpcomingRenewalItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    subscription_id: int
    customer_id: int
    customer_name: str
    plan_name: str
    next_billing_date: str
    total: str

