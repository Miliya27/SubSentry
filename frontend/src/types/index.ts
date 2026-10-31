/**
 * src/types/index.ts
 * Central TypeScript type definitions derived from docs/API_CONTRACT.md
 * (contract was empty at scaffold time – types reflect task description enums)
 */

// ─── API Error Envelope ────────────────────────────────────────────────────
export interface ApiError {
  detail: string;
  code?: string;
  field_errors?: Record<string, string[]>;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ─── Auth ──────────────────────────────────────────────────────────────────
export type UserRole = 'admin' | 'staff' | 'customer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface AuthTokens {
  access_token: string;
  token_type: 'bearer';
}

// ─── Status Enums ──────────────────────────────────────────────────────────
// Subscription statuses
export type SubscriptionStatus =
  | 'active'
  | 'paused'
  | 'cancelled'
  | 'expired'
  | 'pending'
  | 'trialing';

// Invoice statuses
export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'paid'
  | 'overdue'
  | 'voided'
  | 'partially_paid';

// Payment statuses
export type PaymentStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

// Quotation statuses
export type QuotationStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'expired';

// Plan billing intervals
export type BillingInterval = 'monthly' | 'quarterly' | 'yearly' | 'custom';

// Discount types
export type DiscountType = 'percentage' | 'fixed';

// Tax types
export type TaxType = 'gst' | 'igst' | 'vat' | 'custom';

// ─── Domain Models ─────────────────────────────────────────────────────────
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  created_at: string;
  updated_at: string;
}

export interface Plan {
  id: string;
  name: string;
  description?: string;
  price: number;
  billing_interval: BillingInterval;
  features: string[];
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  unit_price: number;
  is_active: boolean;
  created_at: string;
}

export interface Subscription {
  id: string;
  customer_id: string;
  customer?: Customer;
  plan_id: string;
  plan?: Plan;
  status: SubscriptionStatus;
  start_date: string;
  end_date?: string;
  trial_end_date?: string;
  next_billing_date?: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer?: Customer;
  subscription_id?: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  paid_amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  invoice?: Invoice;
  amount: number;
  status: PaymentStatus;
  payment_method?: string;
  transaction_id?: string;
  paid_at?: string;
  created_at: string;
}

export interface Discount {
  id: string;
  code: string;
  type: DiscountType;
  value: number;
  max_uses?: number;
  used_count: number;
  valid_from?: string;
  valid_until?: string;
  is_active: boolean;
  created_at: string;
}

export interface Tax {
  id: string;
  name: string;
  type: TaxType;
  rate: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export interface QuotationTemplate {
  id: string;
  name: string;
  description?: string;
  status: QuotationStatus;
  valid_days: number;
  created_at: string;
}

export interface Report {
  id: string;
  name: string;
  type: string;
  generated_at: string;
}

// ─── UI Helpers ────────────────────────────────────────────────────────────
export interface NavItem {
  label: string;
  path: string;
  icon?: string;
  roles: UserRole[];
}

export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  render?: (value: unknown, row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}
