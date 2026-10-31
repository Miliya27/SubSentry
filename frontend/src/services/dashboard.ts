/**
 * src/services/dashboard.ts
 * Dashboard and Reporting API client matching docs/API_CONTRACT.md (§8.13, §8.14)
 */
import api from './api';
import type { ApiResponse } from '../types';
import type {
  DashboardSummary,
  RevenueTrendItem,
  PlanDistributionItem,
  UpcomingRenewalItem,
  CustomerDashboardData,
  RevenueReportItem,
} from '../types/dashboard';

export const dashboardService = {
  /**
   * KPI metrics summary
   * GET /dashboard/summary
   */
  async getSummary(params?: {
    from?: string;
    to?: string;
  }): Promise<DashboardSummary> {
    const res = await api.get<ApiResponse<DashboardSummary>>(
      '/dashboard/summary',
      { params }
    );
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to load summary');
    }
    return res.data.data;
  },

  /**
   * Monthly revenue trend
   * GET /dashboard/revenue-trend
   */
  async getRevenueTrend(params?: {
    months?: number;
  }): Promise<RevenueTrendItem[]> {
    const res = await api.get<ApiResponse<RevenueTrendItem[]>>(
      '/dashboard/revenue-trend',
      { params }
    );
    return res.data.data || [];
  },

  /**
   * Active plan distribution
   * GET /dashboard/plan-distribution
   */
  async getPlanDistribution(): Promise<PlanDistributionItem[]> {
    const res = await api.get<ApiResponse<PlanDistributionItem[]>>(
      '/dashboard/plan-distribution'
    );
    return res.data.data || [];
  },

  /**
   * Upcoming subscription renewals in next N days
   * GET /dashboard/upcoming-renewals
   */
  async getUpcomingRenewals(params?: {
    days?: number;
  }): Promise<UpcomingRenewalItem[]> {
    const res = await api.get<ApiResponse<UpcomingRenewalItem[]>>(
      '/dashboard/upcoming-renewals',
      { params }
    );
    return res.data.data || [];
  },

  /**
   * Customer portal metrics
   * GET /dashboard/customer
   */
  async getCustomerDashboard(): Promise<CustomerDashboardData> {
    const res = await api.get<ApiResponse<CustomerDashboardData>>(
      '/dashboard/customer'
    );
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to load customer metrics');
    }
    return res.data.data;
  },

  /**
   * Revenue report with grouped periods
   * GET /reports/revenue
   */
  async getRevenueReport(params: {
    from: string;
    to: string;
    group_by?: 'day' | 'week' | 'month';
  }): Promise<RevenueReportItem[]> {
    const res = await api.get<ApiResponse<RevenueReportItem[]>>(
      '/reports/revenue',
      { params }
    );
    return res.data.data || [];
  },

  /**
   * Download Invoices CSV
   * GET /reports/invoices.csv
   */
  async downloadInvoicesCsv(params?: Record<string, unknown>): Promise<Blob> {
    const res = await api.get('/reports/invoices.csv', {
      params,
      responseType: 'blob',
    });
    return res.data;
  },
};

export default dashboardService;
