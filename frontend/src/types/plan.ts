/**
 * src/types/plan.ts
 * TypeScript models and input shapes for Plans derived from docs/API_CONTRACT.md (§8.5)
 */
import type { Product } from './product';

export type BillingFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Plan {
  id: number;
  name: string;
  product_id: number;
  price: string;
  billing_frequency: BillingFrequency;
  min_quantity: number;
  trial_days: number;
  available_from: string | null;
  available_until: string | null;
  auto_close_days: number | null;
  allow_early_close: boolean;
  allow_pause: boolean;
  allow_renewal: boolean;
  is_active: boolean;
  created_at: string;
  product?: Product;
}

export interface CreatePlanInput {
  name: string;
  product_id: number;
  price: string;
  billing_frequency: BillingFrequency;
  min_quantity: number;
  trial_days?: number;
  available_from?: string | null;
  available_until?: string | null;
  auto_close_days?: number | null;
  allow_early_close?: boolean;
  allow_pause?: boolean;
  allow_renewal?: boolean;
}

export interface UpdatePlanInput extends Partial<CreatePlanInput> {
  is_active?: boolean;
}
