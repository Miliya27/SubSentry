/**
 * src/services/payments.ts
 * Payments API client matching docs/API_CONTRACT.md (§8.12)
 */
import api from './api';
import type {
  PaginatedResponse,
  ApiResponse,
} from '../types';
import type {
  PaymentItem,
  RecordPaymentInput,
  RecordPaymentResponse,
} from '../types/payment';

export const paymentsService = {
  /**
   * List payments with filtering and pagination
   * GET /payments
   */
  async getPayments(params?: {
    page?: number;
    page_size?: number;
    customer_id?: number | string;
    invoice_id?: number | string;
    method?: string;
    from?: string;
    to?: string;
  }): Promise<PaginatedResponse<PaymentItem>> {
    const res = await api.get<PaginatedResponse<PaymentItem>>('/payments', {
      params,
    });
    return res.data;
  },

  /**
   * Record a payment against an invoice
   * POST /invoices/{id}/payments
   */
  async recordPayment(
    invoiceId: number | string,
    data: RecordPaymentInput
  ): Promise<RecordPaymentResponse> {
    const res = await api.post<ApiResponse<RecordPaymentResponse>>(
      `/invoices/${invoiceId}/payments`,
      data
    );
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to record payment');
    }
    return res.data.data;
  },
};

export default paymentsService;
