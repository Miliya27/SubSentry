/**
 * src/services/discounts.ts
 * Discounts API client matching docs/API_CONTRACT.md (§8.11)
 */
import api from './api';
import type { PaginatedResponse, ApiResponse } from '../types';
import type {
  Discount,
  CreateDiscountInput,
  UpdateDiscountInput,
} from '../types/discount';

export const discountsService = {
  /**
   * List discounts (admin only)
   * GET /discounts
   */
  async getDiscounts(params?: {
    page?: number;
    page_size?: number;
    q?: string;
    is_active?: boolean;
    type?: string;
  }): Promise<PaginatedResponse<Discount>> {
    const res = await api.get<PaginatedResponse<Discount>>('/discounts', {
      params,
    });
    return res.data;
  },

  /**
   * Get single discount by ID
   * GET /discounts/{id}
   */
  async getDiscount(id: number | string): Promise<Discount> {
    const res = await api.get<ApiResponse<Discount>>(`/discounts/${id}`);
    if (!res.data.data) {
      throw new Error(res.data.message || 'Discount not found');
    }
    return res.data.data;
  },

  /**
   * Create new discount rule
   * POST /discounts
   */
  async createDiscount(data: CreateDiscountInput): Promise<Discount> {
    const res = await api.post<ApiResponse<Discount>>('/discounts', data);
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to create discount');
    }
    return res.data.data;
  },

  /**
   * Update existing discount rule
   * PUT /discounts/{id}
   */
  async updateDiscount(
    id: number | string,
    data: UpdateDiscountInput
  ): Promise<Discount> {
    const res = await api.put<ApiResponse<Discount>>(`/discounts/${id}`, data);
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to update discount');
    }
    return res.data.data;
  },

  /**
   * Soft-delete discount rule
   * DELETE /discounts/{id}
   */
  async deleteDiscount(id: number | string): Promise<{ message: string }> {
    const res = await api.delete<ApiResponse<{ message: string }>>(
      `/discounts/${id}`
    );
    return res.data.data || { message: res.data.message || 'Discount deleted.' };
  },
};

export default discountsService;
