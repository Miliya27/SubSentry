/**
 * src/services/billing.ts
 * Billing runs API client matching docs/API_CONTRACT.md (§8.8)
 */
import api from './api';
import type {
  ApiResponse,
  BillingPreviewData,
  BillingRunResult,
} from '../types';

export const billingService = {
  /**
   * Dry-run preview: shows which invoices would be created without committing
   * GET /billing/preview?as_of=YYYY-MM-DD
   */
  async previewBilling(params: { as_of: string }): Promise<BillingPreviewData> {
    const res = await api.get<ApiResponse<BillingPreviewData>>(
      '/billing/preview',
      { params }
    );
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to preview billing run');
    }
    return res.data.data;
  },

  /**
   * Execute billing run for all active subscriptions with next_billing_date <= as_of_date
   * POST /billing/run
   */
  async runBilling(body: { as_of_date: string }): Promise<BillingRunResult> {
    const res = await api.post<ApiResponse<BillingRunResult>>(
      '/billing/run',
      body
    );
    if (!res.data.data) {
      throw new Error(res.data.message || 'Billing run failed');
    }
    return res.data.data;
  },
};

export default billingService;
