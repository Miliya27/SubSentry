/**
 * src/services/templates.ts
 * Real API calls for Quotation Templates matching docs/API_CONTRACT.md (§8.6)
 */
import api from './api';
import type {
  ApiResponse,
  PaginatedResponse,
  QuotationTemplate,
  CreateQuotationTemplateInput,
  UpdateQuotationTemplateInput,
} from '../types';

export const templatesService = {
  /**
   * List quotation templates
   * GET /quotation-templates
   */
  async getTemplates(params?: {
    page?: number;
    page_size?: number;
    q?: string;
    customer_id?: number;
    status?: string;
  }): Promise<PaginatedResponse<QuotationTemplate>> {
    const res = await api.get<PaginatedResponse<QuotationTemplate>>(
      '/quotation-templates',
      { params }
    );
    return res.data;
  },

  /**
   * Get template by ID
   * GET /quotation-templates/{id}
   */
  async getTemplate(id: number | string): Promise<QuotationTemplate> {
    const res = await api.get<ApiResponse<QuotationTemplate>>(
      `/quotation-templates/${id}`
    );
    return res.data.data!;
  },

  /**
   * Create quotation template
   * POST /quotation-templates
   */
  async createTemplate(
    data: CreateQuotationTemplateInput
  ): Promise<QuotationTemplate> {
    const res = await api.post<ApiResponse<QuotationTemplate>>(
      '/quotation-templates',
      data
    );
    return res.data.data!;
  },

  /**
   * Update quotation template
   * PUT /quotation-templates/{id}
   */
  async updateTemplate(
    id: number | string,
    data: UpdateQuotationTemplateInput
  ): Promise<QuotationTemplate> {
    const res = await api.put<ApiResponse<QuotationTemplate>>(
      `/quotation-templates/${id}`,
      data
    );
    return res.data.data!;
  },

  /**
   * Delete quotation template
   * DELETE /quotation-templates/{id}
   */
  async deleteTemplate(id: number | string): Promise<{ message: string }> {
    const res = await api.delete<ApiResponse<{ message: string }>>(
      `/quotation-templates/${id}`
    );
    return res.data.data!;
  },
};

export default templatesService;
