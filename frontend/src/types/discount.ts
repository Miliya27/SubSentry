/**
 * src/types/discount.ts
 * Discount definitions matching docs/API_CONTRACT.md (§8.11)
 */
import type { DiscountType } from './index';

export interface Discount {
  id: number;
  name: string;
  type: DiscountType;
  value: string;
  min_amount?: string;
  min_quantity?: number | null;
  max_uses?: number | null;
  uses_count?: number;
  usage_count?: number; // alias
  valid_from?: string | null;
  valid_until?: string | null;
  is_active: boolean;
  scope?: 'product' | 'subscription' | 'all';
  product_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateDiscountInput {
  name: string;
  type: DiscountType;
  value: string;
  min_amount?: string;
  min_quantity?: number | null;
  max_uses?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
  scope?: string;
  product_id?: number | null;
}

export interface UpdateDiscountInput {
  name?: string;
  type?: DiscountType;
  value?: string;
  min_amount?: string;
  min_quantity?: number | null;
  max_uses?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active?: boolean;
  scope?: string;
  product_id?: number | null;
}
