/**
 * src/services/invoices.ts
 * Invoices API client matching docs/API_CONTRACT.md (§8.9)
 */
import api from './api';
import type {
  PaginatedResponse,
  ApiResponse,
  Invoice,
  InvoicePrintData,
} from '../types';

export const invoicesService = {
  /**
   * List invoices with filtering, search, and pagination
   * GET /invoices
   */
  async getInvoices(params?: {
    page?: number;
    page_size?: number;
    q?: string;
    status?: string;
    customer_id?: number | string;
    subscription_id?: number | string;
    from?: string;
    to?: string;
    sort?: string;
    sort_dir?: 'asc' | 'desc';
    is_overdue?: boolean;
    payment_state?: string;
  }): Promise<PaginatedResponse<Invoice>> {
    const res = await api.get<PaginatedResponse<Invoice>>('/invoices', {
      params,
    });
    return res.data;
  },

  /**
   * Get single invoice with full line items and payment history
   * GET /invoices/{id}
   */
  async getInvoice(id: number | string): Promise<Invoice> {
    const res = await api.get<ApiResponse<Invoice>>(`/invoices/${id}`);
    if (!res.data.data) {
      throw new Error(res.data.message || 'Invoice not found');
    }
    return res.data.data;
  },

  /**
   * Transition draft -> confirmed
   * POST /invoices/{id}/confirm
   */
  async confirmInvoice(id: number | string): Promise<Invoice> {
    const res = await api.post<ApiResponse<Invoice>>(`/invoices/${id}/confirm`);
    return res.data.data!;
  },

  /**
   * Transition draft|confirmed -> cancelled
   * POST /invoices/{id}/cancel
   */
  async cancelInvoice(id: number | string): Promise<Invoice> {
    const res = await api.post<ApiResponse<Invoice>>(`/invoices/${id}/cancel`);
    return res.data.data!;
  },

  /**
   * Email invoice PDF to customer
   * POST /invoices/{id}/send
   */
  async sendInvoice(id: number | string): Promise<{ message: string }> {
    const res = await api.post<ApiResponse<{ message: string }>>(
      `/invoices/${id}/send`
    );
    return res.data.data || { message: res.data.message || 'Invoice sent.' };
  },

  /**
   * Get print layout payload
   * GET /invoices/{id}/print
   */
  async getInvoicePrint(id: number | string): Promise<InvoicePrintData> {
    const res = await api.get<ApiResponse<InvoicePrintData>>(
      `/invoices/${id}/print`
    );
    if (!res.data.data) {
      throw new Error(res.data.message || 'Unable to load invoice print data');
    }
    return res.data.data;
  },
};

export default invoicesService;
