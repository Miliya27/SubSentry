/**
 * src/services/taxes.ts
 * Tax rules API client matching docs/API_CONTRACT.md (§8.10)
 */
import api from './api';
import type { PaginatedResponse, ApiResponse, Tax } from '../types';

export interface CreateTaxInput {
  name: string;
  rate_percent: string | number;
  is_default?: boolean;
  applies_to?: 'all' | 'product' | 'hsn';
  hsn_code?: string | null;
}

export interface UpdateTaxInput {
  name?: string;
  rate_percent?: string | number;
  is_default?: boolean;
  is_active?: boolean;
  applies_to?: 'all' | 'product' | 'hsn';
  hsn_code?: string | null;
}

export const taxesService = {
  /**
   * List tax rules
   * GET /taxes
   */
  async getTaxes(params?: {
    page?: number;
    page_size?: number;
    q?: string;
    is_active?: boolean;
    is_default?: boolean;
  }): Promise<PaginatedResponse<Tax>> {
    const res = await api.get<PaginatedResponse<Tax>>('/taxes', {
      params,
    });
    return res.data;
  },

  /**
   * Create tax rule (admin)
   * POST /taxes
   */
  async createTax(data: CreateTaxInput): Promise<Tax> {
    const res = await api.post<ApiResponse<Tax>>('/taxes', data);
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to create tax rule');
    }
    return res.data.data;
  },

  /**
   * Update tax rule (admin)
   * PUT /taxes/{id}
   */
  async updateTax(id: number | string, data: UpdateTaxInput): Promise<Tax> {
    const res = await api.put<ApiResponse<Tax>>(`/taxes/${id}`, data);
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to update tax rule');
    }
    return res.data.data;
  },

  /**
   * Soft-delete tax rule (admin)
   * DELETE /taxes/{id}
   */
  async deleteTax(id: number | string): Promise<{ message: string }> {
    const res = await api.delete<ApiResponse<{ message: string }>>(`/taxes/${id}`);
    return res.data.data || { message: res.data.message || 'Tax rule deactivated.' };
  },
};

export default taxesService;
