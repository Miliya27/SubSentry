/**
 * src/services/subscriptions.ts
 * Real API calls and lifecycle transitions for Subscriptions matching docs/API_CONTRACT.md (§8.7)
 */
import api from './api';
import type {
  ApiResponse,
  PaginatedResponse,
  Subscription,
  CreateSubscriptionInput,
  CreateSubscriptionFromTemplateInput,
  UpdateSubscriptionInput,
} from '../types';

export const subscriptionsService = {
  /**
   * List paginated subscriptions
   * GET /subscriptions
   */
  async getSubscriptions(params?: {
    page?: number;
    page_size?: number;
    status?: string;
    customer_id?: number | string;
    plan_id?: number | string;
    q?: string;
    sort?: string;
  }): Promise<PaginatedResponse<Subscription>> {
    const res = await api.get<PaginatedResponse<Subscription>>(
      '/subscriptions',
      { params }
    );
    return res.data;
  },

  /**
   * Get single subscription with lines
   * GET /subscriptions/{id}
   */
  async getSubscription(id: number | string): Promise<Subscription> {
    const res = await api.get<ApiResponse<Subscription>>(`/subscriptions/${id}`);
    return res.data.data!;
  },

  /**
   * Create a new subscription in draft status
   * POST /subscriptions
   */
  async createSubscription(
    data: CreateSubscriptionInput
  ): Promise<Subscription> {
    const res = await api.post<ApiResponse<Subscription>>(
      '/subscriptions',
      data
    );
    return res.data.data!;
  },

  /**
   * Create subscription from template
   * POST /subscriptions/from-template
   */
  async createFromTemplate(
    data: CreateSubscriptionFromTemplateInput
  ): Promise<Subscription> {
    const res = await api.post<ApiResponse<Subscription>>(
      '/subscriptions/from-template',
      data
    );
    return res.data.data!;
  },

  /**
   * Update subscription (only allowed when draft)
   * PUT /subscriptions/{id}
   */
  async updateSubscription(
    id: number | string,
    data: UpdateSubscriptionInput
  ): Promise<Subscription> {
    const res = await api.put<ApiResponse<Subscription>>(
      `/subscriptions/${id}`,
      data
    );
    return res.data.data!;
  },

  // ─── Lifecycle Transitions ───────────────────────────────────────────────

  /**
   * Transition: draft -> quotation
   * POST /subscriptions/{id}/send-quotation
   */
  async sendQuotation(id: number | string): Promise<{ id: number; status: string }> {
    const res = await api.post<ApiResponse<{ id: number; status: string }>>(
      `/subscriptions/${id}/send-quotation`
    );
    return res.data.data!;
  },

  /**
   * Transition: quotation -> confirmed
   * POST /subscriptions/{id}/confirm
   */
  async confirmSubscription(
    id: number | string
  ): Promise<{ id: number; status: string }> {
    const res = await api.post<ApiResponse<{ id: number; status: string }>>(
      `/subscriptions/${id}/confirm`
    );
    return res.data.data!;
  },

  /**
   * Transition: confirmed -> active
   * POST /subscriptions/{id}/activate
   */
  async activateSubscription(
    id: number | string
  ): Promise<{ id: number; status: string; next_billing_date?: string }> {
    const res = await api.post<
      ApiResponse<{ id: number; status: string; next_billing_date?: string }>
    >(`/subscriptions/${id}/activate`);
    return res.data.data!;
  },

  /**
   * Transition: active -> paused
   * POST /subscriptions/{id}/pause
   */
  async pauseSubscription(
    id: number | string
  ): Promise<{ id: number; status: string }> {
    const res = await api.post<ApiResponse<{ id: number; status: string }>>(
      `/subscriptions/${id}/pause`
    );
    return res.data.data!;
  },

  /**
   * Transition: paused -> active
   * POST /subscriptions/{id}/resume
   */
  async resumeSubscription(
    id: number | string
  ): Promise<{ id: number; status: string }> {
    const res = await api.post<ApiResponse<{ id: number; status: string }>>(
      `/subscriptions/${id}/resume`
    );
    return res.data.data!;
  },

  /**
   * Action: renew (extends expiry_date)
   * POST /subscriptions/{id}/renew
   */
  async renewSubscription(
    id: number | string
  ): Promise<{ id: number; status: string; expiry_date: string }> {
    const res = await api.post<
      ApiResponse<{ id: number; status: string; expiry_date: string }>
    >(`/subscriptions/${id}/renew`);
    return res.data.data!;
  },

  /**
   * Transition: active|paused -> closed
   * POST /subscriptions/{id}/close
   */
  async closeSubscription(
    id: number | string
  ): Promise<{ id: number; status: string; cancelled_at: string }> {
    const res = await api.post<
      ApiResponse<{ id: number; status: string; cancelled_at: string }>
    >(`/subscriptions/${id}/close`);
    return res.data.data!;
  },
};

export default subscriptionsService;
