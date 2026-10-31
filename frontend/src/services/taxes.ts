/**
 * src/services/taxes.ts
 * Service functions to query taxes/tax rules for form use (§8.10).
 * Note: Taxes page UI is scheduled for a future stage.
 */
import api from './api';
import type { PaginatedResponse, Tax } from '../types';

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
};

export default taxesService;
