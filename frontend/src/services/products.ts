/**
 * src/services/products.ts
 * Real API integration for Products, Variants and Price calculation (§8.4)
 */
import api from './api';
import type {
  ApiResponse,
  PaginatedResponse,
  Product,
  ProductVariant,
  CreateProductInput,
  UpdateProductInput,
  CreateVariantInput,
  UpdateVariantInput,
  PricePreviewResponse,
} from '../types';

export const productsService = {
  /**
   * List paginated products
   * GET /products
   */
  async getProducts(params?: {
    page?: number;
    page_size?: number;
    q?: string;
    is_active?: boolean;
  }): Promise<PaginatedResponse<Product>> {
    const res = await api.get<PaginatedResponse<Product>>('/products', {
      params,
    });
    return res.data;
  },

  /**
   * Get single product with variants
   * GET /products/{id}
   */
  async getProduct(id: number | string): Promise<Product> {
    const res = await api.get<ApiResponse<Product>>(`/products/${id}`);
    return res.data.data!;
  },

  /**
   * Create a new product
   * POST /products (admin only)
   */
  async createProduct(data: CreateProductInput): Promise<Product> {
    const res = await api.post<ApiResponse<Product>>('/products', data);
    return res.data.data!;
  },

  /**
   * Update an existing product
   * PUT /products/{id} (admin only)
   */
  async updateProduct(
    id: number | string,
    data: UpdateProductInput
  ): Promise<Product> {
    const res = await api.put<ApiResponse<Product>>(`/products/${id}`, data);
    return res.data.data!;
  },

  /**
   * Soft-delete product
   * DELETE /products/{id} (admin only)
   */
  async deleteProduct(id: number | string): Promise<{ message: string }> {
    const res = await api.delete<ApiResponse<{ message: string }>>(
      `/products/${id}`
    );
    return res.data.data!;
  },

  /**
   * Get all variants for a product
   * GET /products/{id}/variants
   */
  async getVariants(productId: number | string): Promise<ProductVariant[]> {
    const res = await api.get<ApiResponse<ProductVariant[]>>(
      `/products/${productId}/variants`
    );
    return res.data.data || [];
  },

  /**
   * Create a variant for a product
   * POST /products/{id}/variants (admin only)
   */
  async createVariant(
    productId: number | string,
    data: CreateVariantInput
  ): Promise<ProductVariant> {
    const res = await api.post<ApiResponse<ProductVariant>>(
      `/products/${productId}/variants`,
      data
    );
    return res.data.data!;
  },

  /**
   * Update an existing variant
   * PUT /variants/{id} (admin only)
   */
  async updateVariant(
    variantId: number | string,
    data: UpdateVariantInput
  ): Promise<ProductVariant> {
    const res = await api.put<ApiResponse<ProductVariant>>(
      `/variants/${variantId}`,
      data
    );
    return res.data.data!;
  },

  /**
   * Soft-delete variant
   * DELETE /variants/{id} (admin only)
   */
  async deleteVariant(variantId: number | string): Promise<{ message: string }> {
    const res = await api.delete<ApiResponse<{ message: string }>>(
      `/variants/${variantId}`
    );
    return res.data.data!;
  },

  /**
   * Compute final per-unit price via the backend API
   * GET /products/{id}/price?variant_id=...
   * Note: Do NOT compute price on frontend. Always use this API.
   */
  async getPricePreview(
    productId: number | string,
    variantId?: number | string | null
  ): Promise<PricePreviewResponse> {
    const res = await api.get<ApiResponse<PricePreviewResponse>>(
      `/products/${productId}/price`,
      {
        params: variantId ? { variant_id: variantId } : {},
      }
    );
    return res.data.data!;
  },
};

export default productsService;
