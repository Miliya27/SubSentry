/**
 * src/pages/TemplateFormPage.tsx
 * Quotation template create and edit form with dynamic lines.
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { templatesService } from '../services/templates';
import { productsService } from '../services/products';
import { taxesService } from '../services/taxes';
import { getErrorMessage } from '../services/api';
import { toMoneyString } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Card, CardHeader, CardBody } from '../components/Card';
import { Spinner } from '../components/Spinner';
import type { Product, Tax } from '../types';

interface TemplateLineFormData {
  product_variant_id: string;
  description: string;
  quantity: number;
  unit_price: string;
  discount: string;
  tax_rule_id: string;
}

interface TemplateFormData {
  name: string;
  validity_days: number;
  valid_until: string;
  notes: string;
  lines: TemplateLineFormData[];
}

export default function TemplateFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = Boolean(id);
  const canEdit = user?.role === 'admin' || user?.role === 'staff';

  const [isLoading, setIsLoading] = useState(isEdit);
  const [products, setProducts] = useState<Product[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TemplateFormData>({
    defaultValues: {
      name: '',
      validity_days: 30,
      valid_until: '',
      notes: '',
      lines: [
        {
          product_variant_id: '',
          description: '',
          quantity: 1,
          unit_price: '0.00',
          discount: '0.00',
          tax_rule_id: '',
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  });

  // Load products and taxes
  useEffect(() => {
    async function loadCatalog() {
      try {
        const [prodRes, taxRes] = await Promise.all([
          productsService.getProducts({ page_size: 100 }),
          taxesService.getTaxes({ page_size: 100 }),
        ]);
        setProducts(prodRes.data);
        setTaxes(taxRes.data);
      } catch (err: unknown) {
        console.error('Failed to load catalog data:', err);
      }
    }
    loadCatalog();
  }, []);

  // Fetch template if in edit mode
  const fetchTemplate = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setServerError(null);
    try {
      const data = await templatesService.getTemplate(id);
      reset({
        name: data.name,
        validity_days: data.validity_days,
        valid_until: data.valid_until || '',
        notes: data.notes || '',
        lines:
          data.lines && data.lines.length > 0
            ? data.lines.map((l) => ({
                product_variant_id: String(l.product_variant_id),
                description: l.description || '',
                quantity: Number(l.quantity) || 1,
                unit_price: l.unit_price ? String(l.unit_price) : '0.00',
                discount: l.discount ? String(l.discount) : '0.00',
                tax_rule_id: l.tax_rule_id ? String(l.tax_rule_id) : '',
              }))
            : [
                {
                  product_variant_id: '',
                  description: '',
                  quantity: 1,
                  unit_price: '0.00',
                  discount: '0.00',
                  tax_rule_id: '',
                },
              ],
      });
    } catch (err: unknown) {
      setServerError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [id, reset]);

  useEffect(() => {
    if (isEdit) {
      fetchTemplate();
    }
  }, [isEdit, fetchTemplate]);

  // Flatten all variants across loaded products for easy selection
  const allVariants: { id: number; label: string; price: string }[] = [];
  for (const p of products) {
    if (p.variants && p.variants.length > 0) {
      for (const v of p.variants) {
        allVariants.push({
          id: v.id,
          label: `${p.name} — ${v.attribute}: ${v.value} (+₹${v.extra_price})`,
          price: p.sales_price,
        });
      }
    } else {
      allVariants.push({
        id: p.id,
        label: `${p.name} (Base - ₹${p.sales_price})`,
        price: p.sales_price,
      });
    }
  }

  async function onSubmit(data: TemplateFormData) {
    if (!canEdit) return;
    setServerError(null);
    setSaveSuccess(false);

    const payload = {
      name: data.name.trim(),
      validity_days: Number(data.validity_days),
      valid_until: data.valid_until || null,
      notes: data.notes.trim() || null,
      lines: data.lines.map((l) => ({
        product_variant_id: parseInt(l.product_variant_id, 10),
        description: l.description.trim() || undefined,
        quantity: Number(l.quantity),
        unit_price: toMoneyString(l.unit_price),
        discount: toMoneyString(l.discount),
        tax_rule_id: l.tax_rule_id ? parseInt(l.tax_rule_id, 10) : null,
      })),
    };

    try {
      if (isEdit && id) {
        await templatesService.updateTemplate(id, payload);
        setSaveSuccess(true);
      } else {
        await templatesService.createTemplate(payload);
        navigate('/quotations/templates', { replace: true });
      }
    } catch (err: unknown) {
      setServerError(getErrorMessage(err));
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <PageHeader
        title={isEdit ? 'Edit Quotation Template' : 'New Quotation Template'}
        subtitle="Define preset lines, quantity limits, and terms for rapid quotation generation"
        actions={
          <Button
            variant="secondary"
            onClick={() => navigate('/quotations/templates')}
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Templates
          </Button>
        }
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Templates', href: '/quotations/templates' },
          { label: isEdit ? 'Edit' : 'New' },
        ]}
      />

      {serverError && (
        <div className="alert-error" role="alert">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p className="flex-1">{serverError}</p>
        </div>
      )}

      {saveSuccess && (
        <div className="alert-success" role="status">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p className="flex-1">Template saved successfully.</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {/* Template Overview Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">
                Template Details
              </h2>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="label" htmlFor="template-name-input">
                  Template Name *
                </label>
                <input
                  id="template-name-input"
                  type="text"
                  placeholder="e.g. Standard Odoo Enterprise Package"
                  className={`input ${errors.name ? 'input-error' : ''}`}
                  {...register('name', { required: 'Template name is required' })}
                />
                {errors.name && (
                  <p className="error-msg">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="label" htmlFor="template-validity-input">
                  Validity Period (Days) *
                </label>
                <input
                  id="template-validity-input"
                  type="number"
                  min="1"
                  className="input"
                  {...register('validity_days', { valueAsNumber: true })}
                />
              </div>

              <div>
                <label className="label" htmlFor="template-until-input">
                  Fixed Expiry Date (Optional)
                </label>
                <input
                  id="template-until-input"
                  type="date"
                  className="input"
                  {...register('valid_until')}
                />
              </div>

              <div className="md:col-span-2">
                <label className="label" htmlFor="template-notes-input">
                  Notes / Package Terms
                </label>
                <textarea
                  id="template-notes-input"
                  rows={2}
                  placeholder="Additional terms, inclusion notes, or SLA guidelines"
                  className="input"
                  {...register('notes')}
                />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Template Lines Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">
                Preset Package Lines
              </h3>
            </div>
            {canEdit && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  append({
                    product_variant_id: '',
                    description: '',
                    quantity: 1,
                    unit_price: '0.00',
                    discount: '0.00',
                    tax_rule_id: '',
                  })
                }
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Line
              </Button>
            )}
          </CardHeader>
          <CardBody className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    Line #{index + 1}
                  </span>
                  {fields.length > 1 && canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-rose-600 hover:text-rose-700"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="label">Product / Variant *</label>
                    <select
                      className="input"
                      {...register(`lines.${index}.product_variant_id` as const, {
                        required: true,
                      })}
                    >
                      <option value="">-- Choose product or variant --</option>
                      {allVariants.map((v) => (
                        <option key={v.id} value={String(v.id)}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">Quantity *</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      className="input"
                      {...register(`lines.${index}.quantity` as const, {
                        valueAsNumber: true,
                      })}
                    />
                  </div>

                  <div>
                    <label className="label">Unit Price (INR)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="input"
                      {...register(`lines.${index}.unit_price` as const)}
                    />
                  </div>

                  <div>
                    <label className="label">Discount (INR)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="input"
                      {...register(`lines.${index}.discount` as const)}
                    />
                  </div>

                  <div>
                    <label className="label">Tax Rule</label>
                    <select
                      className="input"
                      {...register(`lines.${index}.tax_rule_id` as const)}
                    >
                      <option value="">None / Exempt</option>
                      {taxes.map((t) => (
                        <option key={t.id} value={String(t.id)}>
                          {t.name} ({t.rate_percent || t.rate}%)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <label className="label">Line Description (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Odoo ERP – 5 users license bundle"
                      className="input"
                      {...register(`lines.${index}.description` as const)}
                    />
                  </div>
                </div>
              </div>
            ))}

            {canEdit && (
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting}
                  id="save-template-button"
                >
                  {isSubmitting ? (
                    <>
                      <Spinner size="sm" className="mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1.5" />
                      {isEdit ? 'Save Changes' : 'Create Template'}
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </form>
    </div>
  );
}
