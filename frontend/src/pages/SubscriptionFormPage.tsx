/**
 * src/pages/SubscriptionFormPage.tsx
 * Subscription creation form with support for manual line entry
 * or instant creation from Quotation Templates (POST /subscriptions/from-template).
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Receipt,
  FileText,
  AlertCircle,
  Building2,
  Layers,
  Sparkles,
} from 'lucide-react';
import { subscriptionsService } from '../services/subscriptions';
import { customersService } from '../services/customers';
import { plansService } from '../services/plans';
import { productsService } from '../services/products';
import { templatesService } from '../services/templates';
import { taxesService } from '../services/taxes';
import { getErrorMessage } from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Card, CardHeader, CardBody } from '../components/Card';
import { Spinner } from '../components/Spinner';
import type {
  Customer,
  Plan,
  Product,
  QuotationTemplate,
  Tax,
} from '../types';

interface SubscriptionFormData {
  mode: 'manual' | 'template';
  template_id: string;
  customer_id: string;
  plan_id: string;
  product_variant_id: string;
  start_date: string;
  expiry_date: string;
  payment_terms_days: number;
  lines: {
    product_variant_id: string;
    quantity: number;
    tax_rule_id: string;
  }[];
}

export default function SubscriptionFormPage() {
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [templates, setTemplates] = useState<QuotationTemplate[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [loadingDependencies, setLoadingDependencies] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SubscriptionFormData>({
    defaultValues: {
      mode: 'manual',
      template_id: '',
      customer_id: '',
      plan_id: '',
      product_variant_id: '',
      start_date: todayStr,
      expiry_date: '',
      payment_terms_days: 15,
      lines: [
        {
          product_variant_id: '',
          quantity: 1,
          tax_rule_id: '',
        },
      ],
    },
  });

  const mode = watch('mode');

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [cRes, pRes, prRes, tRes, taxRes] = await Promise.all([
          customersService.getCustomers({ page_size: 100 }),
          plansService.getPlans({ page_size: 100, is_active: true }),
          productsService.getProducts({ page_size: 100, is_active: true }),
          templatesService.getTemplates({ page_size: 100 }),
          taxesService.getTaxes({ page_size: 100 }),
        ]);
        setCustomers(cRes.data);
        setPlans(pRes.data);
        setProducts(prRes.data);
        setTemplates(tRes.data);
        setTaxes(taxRes.data);
      } catch (err: unknown) {
        console.error('Failed to load dependency data:', err);
      } finally {
        setLoadingDependencies(false);
      }
    }
    loadData();
  }, []);

  // Collect all available variants for line items
  const allVariants: { id: number; label: string }[] = [];
  for (const p of products) {
    if (p.variants && p.variants.length > 0) {
      for (const v of p.variants) {
        allVariants.push({
          id: v.id,
          label: `${p.name} — ${v.attribute}: ${v.value}`,
        });
      }
    } else {
      allVariants.push({
        id: p.id,
        label: `${p.name} (Base Product)`,
      });
    }
  }

  async function onSubmit(data: SubscriptionFormData) {
    setServerError(null);

    try {
      if (data.mode === 'template') {
        if (!data.template_id) {
          setServerError('Please select a quotation template.');
          return;
        }
        const created = await subscriptionsService.createFromTemplate({
          template_id: parseInt(data.template_id, 10),
          customer_id: parseInt(data.customer_id, 10),
          plan_id: parseInt(data.plan_id, 10),
          start_date: data.start_date,
          expiry_date: data.expiry_date || null,
          payment_terms_days: Number(data.payment_terms_days),
        });
        navigate(`/subscriptions/${created.id}`);
      } else {
        const payload = {
          customer_id: parseInt(data.customer_id, 10),
          plan_id: parseInt(data.plan_id, 10),
          product_variant_id: data.product_variant_id
            ? parseInt(data.product_variant_id, 10)
            : null,
          start_date: data.start_date,
          expiry_date: data.expiry_date || null,
          payment_terms_days: Number(data.payment_terms_days),
          lines: data.lines.map((l) => ({
            product_variant_id: parseInt(l.product_variant_id, 10),
            quantity: Number(l.quantity),
            tax_rule_id: l.tax_rule_id ? parseInt(l.tax_rule_id, 10) : null,
          })),
        };
        const created = await subscriptionsService.createSubscription(payload);
        navigate(`/subscriptions/${created.id}`);
      }
    } catch (err: unknown) {
      setServerError(getErrorMessage(err));
    }
  }

  if (loadingDependencies) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <PageHeader
        title="New Subscription"
        subtitle="Initiate a subscription agreement in Draft status for quotation, confirmation, and activation"
        actions={
          <Button
            variant="secondary"
            onClick={() => navigate('/subscriptions')}
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Subscriptions
          </Button>
        }
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Subscriptions', href: '/subscriptions' },
          { label: 'New' },
        ]}
      />

      {serverError && (
        <div className="alert-error" role="alert">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p className="flex-1">{serverError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {/* Creation Mode Switcher Card */}
        <Card>
          <CardBody className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  mode === 'manual'
                    ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  value="manual"
                  className="mt-0.5 text-indigo-600"
                  {...register('mode')}
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block flex items-center gap-1.5">
                    <Receipt className="h-3.5 w-3.5 text-indigo-600" />
                    Custom Line Items
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Manually specify custom products, variants, and quantities.
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  mode === 'template'
                    ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  value="template"
                  className="mt-0.5 text-indigo-600"
                  {...register('mode')}
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                    From Quotation Template
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Auto-populate lines from a pre-configured template package.
                  </span>
                </div>
              </label>
            </div>
          </CardBody>
        </Card>

        {/* Template Selector Card (if template mode) */}
        {mode === 'template' && (
          <Card className="border-indigo-200 bg-indigo-50/20">
            <CardHeader className="border-indigo-100">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Select Quotation Template *
                </h2>
              </div>
            </CardHeader>
            <CardBody>
              <select
                className="input"
                {...register('template_id', {
                  required: mode === 'template',
                })}
              >
                <option value="">-- Choose a quotation template --</option>
                {templates.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name} ({t.lines?.length || 0} lines, {t.validity_days} days validity)
                  </option>
                ))}
              </select>
            </CardBody>
          </Card>
        )}

        {/* Customer & Plan Details Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary-600" />
              <h2 className="text-base font-bold text-slate-900">
                Customer & Terms
              </h2>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="sub-customer-select">
                  Customer Profile *
                </label>
                <select
                  id="sub-customer-select"
                  className={`input ${errors.customer_id ? 'input-error' : ''}`}
                  {...register('customer_id', {
                    required: 'Customer is required',
                  })}
                >
                  <option value="">-- Choose customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.company_name} ({c.user?.email})
                    </option>
                  ))}
                </select>
                {errors.customer_id && (
                  <p className="error-msg">{errors.customer_id.message}</p>
                )}
              </div>

              <div>
                <label className="label" htmlFor="sub-plan-select">
                  Subscription Plan *
                </label>
                <select
                  id="sub-plan-select"
                  className={`input ${errors.plan_id ? 'input-error' : ''}`}
                  {...register('plan_id', {
                    required: 'Plan is required',
                  })}
                >
                  <option value="">-- Choose active plan --</option>
                  {plans.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name} (₹{p.price} / {p.billing_frequency})
                    </option>
                  ))}
                </select>
                {errors.plan_id && (
                  <p className="error-msg">{errors.plan_id.message}</p>
                )}
              </div>

              <div>
                <label className="label" htmlFor="sub-start-date-input">
                  Start Date *
                </label>
                <input
                  id="sub-start-date-input"
                  type="date"
                  className={`input ${errors.start_date ? 'input-error' : ''}`}
                  {...register('start_date', {
                    required: 'Start date is required',
                  })}
                />
              </div>

              <div>
                <label className="label" htmlFor="sub-expiry-date-input">
                  Expiry Date (Optional)
                </label>
                <input
                  id="sub-expiry-date-input"
                  type="date"
                  className="input"
                  {...register('expiry_date')}
                />
              </div>

              <div>
                <label className="label" htmlFor="sub-payment-terms-input">
                  Payment Terms (Days)
                </label>
                <input
                  id="sub-payment-terms-input"
                  type="number"
                  min="0"
                  className="input"
                  {...register('payment_terms_days', { valueAsNumber: true })}
                />
              </div>

              <div>
                <label className="label" htmlFor="sub-header-variant-select">
                  Header Product Variant (Optional)
                </label>
                <select
                  id="sub-header-variant-select"
                  className="input"
                  {...register('product_variant_id')}
                >
                  <option value="">None / Default</option>
                  {allVariants.map((v) => (
                    <option key={v.id} value={String(v.id)}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Lines Card (only in manual mode) */}
        {mode === 'manual' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Subscription Line Items
                </h3>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  append({
                    product_variant_id: '',
                    quantity: 1,
                    tax_rule_id: '',
                  })
                }
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Line
              </Button>
            </CardHeader>
            <CardBody className="space-y-4">
              {fields.map((field, idx) => (
                <div
                  key={field.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Line #{idx + 1}
                    </span>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700"
                        onClick={() => remove(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                      <label className="label">Product / Variant *</label>
                      <select
                        className="input"
                        {...register(
                          `lines.${idx}.product_variant_id` as const,
                          { required: true }
                        )}
                      >
                        <option value="">-- Choose item --</option>
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
                        min="1"
                        className="input"
                        {...register(`lines.${idx}.quantity` as const, {
                          valueAsNumber: true,
                          required: true,
                        })}
                      />
                    </div>

                    <div>
                      <label className="label">Tax Rule</label>
                      <select
                        className="input"
                        {...register(`lines.${idx}.tax_rule_id` as const)}
                      >
                        <option value="">None</option>
                        {taxes.map((t) => (
                          <option key={t.id} value={String(t.id)}>
                            {t.name} ({t.rate_percent || t.rate}%)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              <p className="text-[11px] text-slate-400">
                Note: Exact pricing snapshots, tax calculations, and line totals are computed strictly by the server.
              </p>
            </CardBody>
          </Card>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/subscriptions')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            id="create-subscription-submit"
          >
            {isSubmitting ? (
              <>
                <Spinner size="sm" className="mr-1.5" />
                Creating Draft...
              </>
            ) : (
              'Create Subscription (Draft)'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
