/**
 * src/types/product.ts
 * TypeScript models and input shapes for Products & Variants derived from docs/API_CONTRACT.md (§8.4)
 */

export type ProductType = 'service' | 'software' | 'addon';

export interface ProductVariant {
  id: number;
  product_id: number;
  attribute: string;
  value: string;
  extra_price: string;
  sku: string | null;
  is_active: boolean;
}

export interface Product {
  id: number;
  name: string;
  product_type: ProductType;
  sales_price: string;
  cost_price: string;
  description: string | null;
  unit: string | null;
  hsn_code: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  variants?: ProductVariant[];
}

export interface CreateProductInput {
  name: string;
  product_type?: ProductType;
  sales_price?: string;
  cost_price?: string;
  notes?: string | null;
  description?: string | null;
  unit?: string | null;
  hsn_code?: string | null;
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  is_active?: boolean;
}

export interface CreateVariantInput {
  attribute: string;
  value: string;
  extra_price?: string;
  sku?: string | null;
}

export interface UpdateVariantInput extends Partial<CreateVariantInput> {
  is_active?: boolean;
}

export interface PricePreviewResponse {
  product_id: number;
  variant_id?: number | null;
  sales_price: string;
  extra_price: string;
  final_price: string;
}
