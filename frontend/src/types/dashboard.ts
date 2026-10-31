/**
 * src/types/dashboard.ts
 * Dashboard and Analytics types conforming to docs/API_CONTRACT.md (§8.13, §8.14)
 */

export interface DashboardSummary {
  active_subscriptions: number;
  revenue_received: string;
  total_invoiced: string;
  outstanding: string;
  overdue_count: number;
  overdue_amount: string;
  mrr: string;
  arr: string;
}

export interface RevenueTrendItem {
  month: string;
  invoiced: string;
  received: string;
}

export interface PlanDistributionItem {
  plan_id: number;
  plan_name: string;
  count: number;
  percentage: string;
}

export interface UpcomingRenewalItem {
  subscription_id: number;
  customer_id: number;
  customer_name: string;
  plan_name: string;
  next_billing_date: string;
  total: string;
}

export interface CustomerDashboardData {
  active_subscriptions: number;
  total_invoiced: string;
  amount_paid: string;
  outstanding: string;
  next_renewal: string | null;
}

export interface RevenueReportItem {
  period: string;
  invoiced: string;
  received: string;
  outstanding: string;
}
