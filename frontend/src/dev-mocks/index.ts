/**
 * DEV MOCK - REMOVE BEFORE FINAL
 *
 * src/dev-mocks/index.ts
 * Sample data for layout/component preview during Stage 1.
 * Nothing outside this folder may import these in production paths.
 */
import type {
  Customer,
  Subscription,
  Invoice,
  Payment,
} from '../types';

export const MOCK_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'Acme Corp', email: 'billing@acme.com', company: 'Acme Corp', phone: '+91 98765 43210', created_at: '2024-01-10T00:00:00Z', updated_at: '2024-06-01T00:00:00Z' },
  { id: 'c2', name: 'Globex Ltd', email: 'accounts@globex.com', company: 'Globex Ltd', created_at: '2024-02-20T00:00:00Z', updated_at: '2024-07-15T00:00:00Z' },
];

export const MOCK_SUBSCRIPTIONS: Subscription[] = [
  { id: 's1', customer_id: 'c1', plan_id: 'p1', status: 'active',    amount: 4999, start_date: '2024-01-10T00:00:00Z', created_at: '2024-01-10T00:00:00Z', updated_at: '2024-06-01T00:00:00Z' },
  { id: 's2', customer_id: 'c2', plan_id: 'p2', status: 'paused',    amount: 1999, start_date: '2024-07-01T00:00:00Z', created_at: '2024-07-01T00:00:00Z', updated_at: '2024-07-05T00:00:00Z' },
  { id: 's3', customer_id: 'c1', plan_id: 'p1', status: 'closed',    amount: 4999, start_date: '2023-06-01T00:00:00Z', end_date: '2024-01-09T00:00:00Z', created_at: '2023-06-01T00:00:00Z', updated_at: '2024-01-09T00:00:00Z' },
];

export const MOCK_INVOICES: Invoice[] = [
  { id: 'i1', invoice_number: 'INV-0001', customer_id: 'c1', status: 'paid',    issue_date: '2024-06-01T00:00:00Z', due_date: '2024-06-15T00:00:00Z', subtotal: 4999, tax_amount: 899, discount_amount: 0,   total: 5898, paid_amount: 5898, currency: 'INR', created_at: '2024-06-01T00:00:00Z', updated_at: '2024-06-10T00:00:00Z' },
  { id: 'i2', invoice_number: 'INV-0002', customer_id: 'c2', status: 'overdue', issue_date: '2024-07-01T00:00:00Z', due_date: '2024-07-15T00:00:00Z', subtotal: 1999, tax_amount: 359, discount_amount: 200, total: 2158, paid_amount: 0,    currency: 'INR', created_at: '2024-07-01T00:00:00Z', updated_at: '2024-07-15T00:00:00Z' },
];

export const MOCK_PAYMENTS: Payment[] = [
  { id: 'pay1', invoice_id: 'i1', amount: 5898, payment_method: 'upi', transaction_id: 'TXN123456', paid_at: '2024-06-10T10:30:00Z', created_at: '2024-06-10T10:30:00Z' },
];
