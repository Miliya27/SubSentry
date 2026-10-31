/**
 * src/types/customer.ts
 * Customer model and input payloads matching docs/API_CONTRACT.md (§8.3)
 */

export interface Customer {
  id: number;
  user_id: number;
  company_name: string;
  gstin: string | null;
  billing_address: string;
  shipping_address: string | null;
  credit_limit: string;
  outstanding_balance: string;
  created_at: string;
  user: {
    id: number;
    email: string;
    full_name: string;
    phone?: string | null;
  };
}

export interface CreateCustomerInput {
  user_id: number;
  company_name: string;
  gstin?: string | null;
  billing_address: string;
  shipping_address?: string | null;
  credit_limit?: string;
}

export interface UpdateCustomerInput {
  company_name?: string;
  gstin?: string | null;
  billing_address?: string;
  shipping_address?: string | null;
  credit_limit?: string;
}
