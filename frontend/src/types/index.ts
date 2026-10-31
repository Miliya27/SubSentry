/**
 * src/types/index.ts
 * Central TypeScript type definitions reconciled with docs/API_CONTRACT.md (v1.1.0)
 */

export * from './auth';

// ─── API Response & Error Envelopes ─────────────────────────────────────────
export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: ApiFieldError[] | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
  meta?: {
    page: number;
    page_size: number;
    total: number;
  };
}

export interface PaginatedMeta {
  page: number;
  page_size: number;
  total: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  message?: string;
  meta: PaginatedMeta;
}

// ─── Real Status Enums from docs/API_CONTRACT.md ───────────────────────────
// Subscription status: draft, quotation, confirmed, active, paused, closed
export type SubscriptionStatus =
  | 'draft'
  | 'quotation'
  | 'confirmed'
  | 'active'
  | 'paused'
  | 'closed';

// Invoice status: draft, confirmed, paid, cancelled (+ derived overdue, partially_paid)
export type InvoiceStatus =
  | 'draft'
  | 'confirmed'
  | 'paid'
  | 'cancelled'
  | 'overdue'
  | 'partially_paid';

// Billing frequency
export type BillingFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type BillingInterval = BillingFrequency; // alias for compatibility

// Payment methods
export type PaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'card'
  | 'upi'
  | 'cheque';

// Discount types
export type DiscountType = 'fixed' | 'percent';

// Tax applies to
export type TaxAppliesTo = 'all' | 'product' | 'hsn';

// ─── Domain Models ─────────────────────────────────────────────────────────
export interface Customer {
  id: number | string;
  user_id?: number;
  company_name?: string;
  company?: string; // compatibility alias
  name?: string; // fallback alias
  email?: string;
  phone?: string | null;
  gstin?: string | null;
  billing_address?: string | null;
  shipping_address?: string | null;
  credit_limit?: string | number;
  outstanding_balance?: string | number;
  created_at?: string;
  updated_at?: string;
  user?: {
    id: number;
    email: string;
    full_name: string;
    role: string;
  };
}

export interface Plan {
  id: number | string;
  name: string;
  description?: string;
  price: string | number;
  billing_frequency?: BillingFrequency;
  billing_interval?: BillingInterval;
  features?: string[];
  is_active: boolean;
  allow_pause?: boolean;
  allow_renewal?: boolean;
  allow_early_close?: boolean;
  created_at?: string;
}

export interface Product {
  id: number | string;
  name: string;
  description?: string;
  unit_price: string | number;
  is_active: boolean;
  created_at?: string;
}

export interface Subscription {
  id: number | string;
  customer_id: number | string;
  customer?: Customer;
  plan_id: number | string;
  plan?: Plan;
  status: SubscriptionStatus;
  start_date: string;
  end_date?: string | null;
  next_billing_date?: string | null;
  amount: string | number;
  created_at?: string;
  updated_at?: string;
}

export interface Invoice {
  id: number | string;
  invoice_number: string;
  customer_id: number | string;
  customer?: Customer;
  subscription_id?: number | string | null;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  subtotal: string | number;
  tax_amount: string | number;
  discount_amount: string | number;
  total: string | number;
  paid_amount: string | number;
  currency: string;
  created_at?: string;
  updated_at?: string;
}

export interface Payment {
  id: number | string;
  invoice_id: number | string;
  invoice?: Invoice;
  amount: string | number;
  payment_method?: PaymentMethod | string;
  transaction_id?: string | null;
  payment_reference?: string | null;
  paid_at?: string;
  created_at?: string;
}

export interface Discount {
  id: number | string;
  code: string;
  type: DiscountType;
  value: string | number;
  max_uses?: number | null;
  used_count?: number;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active: boolean;
  created_at?: string;
}

export interface Tax {
  id: number | string;
  name: string;
  rate: string | number;
  applies_to?: TaxAppliesTo;
  hsn_code?: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at?: string;
}

export interface QuotationTemplate {
  id: number | string;
  name: string;
  description?: string;
  valid_days: number;
  created_at?: string;
}

export interface Report {
  id: number | string;
  name: string;
  type: string;
  generated_at?: string;
}

// ─── UI Helpers ────────────────────────────────────────────────────────────
export interface NavItem {
  label: string;
  path: string;
  icon?: string;
  roles: import('./auth').UserRole[];
}

export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  render?: (value: unknown, row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}
