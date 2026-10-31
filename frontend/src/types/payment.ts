/**
 * src/types/payment.ts
 * Types for Payment records and recording payloads matching docs/API_CONTRACT.md (§8.12)
 */
import type { PaymentMethod } from './index';
import type { Invoice } from './invoice';

export interface PaymentItem {
  id: number;
  invoice_id: number;
  customer_id?: number;
  amount: string;
  payment_date: string;
  method: PaymentMethod | string;
  reference?: string | null;
  notes?: string | null;
  created_at?: string;
  invoice?: Invoice;
}

export interface RecordPaymentInput {
  method: PaymentMethod;
  amount: string;
  payment_date: string;
  reference?: string;
  notes?: string;
}

export interface RecordPaymentResponse {
  payment: PaymentItem;
  invoice: Partial<Invoice>;
}
