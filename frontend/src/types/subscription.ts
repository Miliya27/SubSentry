/**
 * src/types/subscription.ts
 * Subscription types and lifecycle state definitions matching docs/API_CONTRACT.md (§8.7)
 */
import type { Customer } from './customer';
import type { Plan } from './plan';

export type SubscriptionStatus =
  | 'draft'
  | 'quotation'
  | 'confirmed'
  | 'active'
  | 'paused'
  | 'closed';

export interface SubscriptionLine {
  id?: number;
  product_variant_id: number;
  quantity: string | number;
  unit_price?: string;
  discount?: string;
  tax_rule_id?: number | null;
  line_total?: string;
}

export interface Subscription {
  id: number;
  subscription_number: string;
  customer_id: number;
  plan_id: number;
  product_variant_id: number | null;
  status: SubscriptionStatus;
  start_date: string;
  expiry_date: string | null;
  payment_terms_days: number;
  next_billing_date: string | null;
  cancelled_at: string | null;
  created_at: string;
  lines: SubscriptionLine[];
  total: string;
  customer?: Customer;
  plan?: Plan;
}

export interface CreateSubscriptionInput {
  customer_id: number;
  plan_id: number;
  product_variant_id?: number | null;
  start_date: string;
  expiry_date?: string | null;
  payment_terms_days?: number;
  lines: {
    product_variant_id: number;
    quantity: number | string;
    tax_rule_id?: number | null;
  }[];
}

export interface CreateSubscriptionFromTemplateInput {
  template_id: number;
  customer_id: number;
  plan_id: number;
  start_date: string;
  expiry_date?: string | null;
  payment_terms_days?: number;
}

export interface UpdateSubscriptionInput {
  start_date?: string;
  expiry_date?: string | null;
  payment_terms_days?: number;
  lines?: {
    product_variant_id: number;
    quantity: number | string;
    tax_rule_id?: number | null;
  }[];
}
