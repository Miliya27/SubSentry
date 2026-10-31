/**
 * src/services/plans.ts
 * Real API integration for Plans (§8.5)
 */
import api from './api';
import type {
  ApiResponse,
  PaginatedResponse,
  Plan,
  CreatePlanInput,
  UpdatePlanInput,
} from '../types';

export const plansService = {
  /**
   * List paginated plans
   * GET /plans
   */
  async getPlans(params?: {
    page?: number;
    page_size?: number;
    q?: string;
    billing_frequency?: string;
    is_active?: boolean;
  }): Promise<PaginatedResponse<Plan>> {
    const res = await api.get<PaginatedResponse<Plan>>('/plans', {
      params,
    });
    return res.data;
  },

  /**
   * Get single plan by ID
   * GET /plans/{id}
   */
  async getPlan(id: number | string): Promise<Plan> {
    const res = await api.get<ApiResponse<Plan>>(`/plans/${id}`);
    return res.data.data!;
  },

  /**
   * Create a new plan
   * POST /plans (admin only)
   */
  async createPlan(data: CreatePlanInput): Promise<Plan> {
    const res = await api.post<ApiResponse<Plan>>('/plans', data);
    return res.data.data!;
  },

  /**
   * Update an existing plan
   * PUT /plans/{id} (admin only)
   */
  async updatePlan(id: number | string, data: UpdatePlanInput): Promise<Plan> {
    const res = await api.put<ApiResponse<Plan>>(`/plans/${id}`, data);
    return res.data.data!;
  },

  /**
   * Soft-delete plan
   * DELETE /plans/{id} (admin only)
   */
  async deletePlan(id: number | string): Promise<{ message: string }> {
    const res = await api.delete<ApiResponse<{ message: string }>>(
      `/plans/${id}`
    );
    return res.data.data!;
  },
};

export default plansService;
