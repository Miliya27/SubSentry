/**
 * src/types/template.ts
 * Quotation template types matching docs/API_CONTRACT.md (§8.6)
 */

export interface QuotationTemplateLine {
  id?: number;
  product_variant_id: number;
  description?: string | null;
  quantity: string | number;
  unit_price?: string;
  discount?: string;
  tax_rule_id?: number | null;
}

export interface QuotationTemplate {
  id: number;
  name: string;
  customer_id?: number | null;
  validity_days: number;
  status: string;
  valid_until?: string | null;
  notes?: string | null;
  created_at: string;
  lines: QuotationTemplateLine[];
}

export interface CreateQuotationTemplateInput {
  name: string;
  customer_id?: number | null;
  validity_days: number;
  valid_until?: string | null;
  notes?: string | null;
  lines: {
    product_variant_id: number;
    description?: string;
    quantity: string | number;
    unit_price?: string;
    discount?: string;
    tax_rule_id?: number | null;
  }[];
}

export interface UpdateQuotationTemplateInput extends Partial<CreateQuotationTemplateInput> {}
