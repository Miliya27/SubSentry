/**
 * src/types/invoice.ts
 * Type definitions for Invoices and Billing runs matching docs/API_CONTRACT.md (§8.8, §8.9)
 */
import type { Customer } from './customer';
import type { InvoiceStatus, PaymentMethod } from './index';

export interface InvoiceLine {
  id: number;
  invoice_id?: number;
  product_variant_id?: number | null;
  description: string;
  quantity: string;
  unit_price: string;
  discount: string;
  tax_rule_id?: number | null;
  line_total: string;
}

export interface InvoicePaymentItem {
  id: number;
  invoice_id?: number;
  amount: string;
  payment_method: PaymentMethod | string;
  transaction_id?: string | null;
  payment_reference?: string | null;
  notes?: string | null;
  payment_date?: string;
  paid_at?: string;
  created_at?: string;
}

export interface Invoice {
  id: number;
  subscription_id?: number | null;
  customer_id: number;
  customer?: Customer;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  period_start?: string | null;
  period_end?: string | null;
  subtotal: string;
  tax_amount: string;
  discount_amount: string;
  total: string;
  amount_paid: string;
  outstanding: string;
  is_overdue?: boolean;
  payment_state?: 'paid' | 'partially_paid' | 'unpaid' | 'overdue';
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  lines?: InvoiceLine[];
  payments?: InvoicePaymentItem[];
}

export interface InvoiceTaxBreakdownItem {
  name: string;
  rate: string;
  taxable_amount: string;
  tax: string;
}

export interface InvoicePrintData {
  invoice: Invoice;
  customer?: Customer;
  lines: InvoiceLine[];
  payments: InvoicePaymentItem[];
  tax_breakdown: InvoiceTaxBreakdownItem[];
}

// ─── Billing Run Types (§8.8) ──────────────────────────────────────────────
export interface BillingPreviewItem {
  id: number;
  customer_id: number;
  next_billing_date: string;
  total: string;
}

export interface BillingPreviewData {
  would_create: number;
  would_skip: number;
  subscriptions: BillingPreviewItem[];
}

export interface BillingRunResult {
  created: number;
  skipped: number;
  failed: number;
  invoice_ids: number[];
  errors: string[];
}
