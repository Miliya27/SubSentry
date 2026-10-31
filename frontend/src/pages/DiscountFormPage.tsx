/**
 * src/pages/DiscountFormPage.tsx
 * Admin discount creation and edit form per docs/API_CONTRACT.md (§8.11).
 * Supports fixed/percentage, min purchase, scope (product/subscription), and validity dates.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  Save,
  Tag,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { discountsService } from '../services/discounts';
import { productsService } from '../services/products';
import { getErrorMessage, getFieldErrors } from '../services/api';
import { toMoneyString } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import { Card, CardHeader, CardBody } from '../components/Card';
import { Spinner } from '../components/Spinner';
import type { Product, DiscountType } from '../types';

const discountSchema = z
  .object({
    name: z.string().min(1, 'Discount name is required').max(100),
    type: z.enum(['fixed', 'percent']),
    value: z
      .string()
      .min(1, 'Value is required')
      .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, {
        message: 'Value must be greater than 0',
      }),
    min_amount: z.string().optional(),
    min_quantity: z.string().optional(),
    max_uses: z.string().optional(),
    valid_from: z.string().optional(),
    valid_until: z.string().optional(),
    scope: z.enum(['all', 'product', 'subscription']),
    product_id: z.string().optional(),
    is_active: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.type === 'percent') {
        const num = parseFloat(data.value);
        return num <= 100;
      }
      return true;
    },
    {
      message: 'Percentage discount cannot exceed 100%',
      path: ['value'],
    }
  )
  .refine(
    (data) => {
      if (data.valid_from && data.valid_until) {
        return new Date(data.valid_until) >= new Date(data.valid_from);
      }
      return true;
    },
    {
      message: 'Valid until must be on or after valid from date',
      path: ['valid_until'],
    }
  );

type DiscountFormData = z.infer<typeof discountSchema>;

export default function DiscountFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors },
  } = useForm<DiscountFormData>({
    resolver: zodResolver(discountSchema),
    defaultValues: {
      name: '',
      type: 'percent',
      value: '10.00',
      min_amount: '0.00',
      min_quantity: '',
      max_uses: '',
      valid_from: '',
      valid_until: '',
      scope: 'all',
      product_id: '',
      is_active: true,
    },
  });

  const selectedType = watch('type');
  const selectedScope = watch('scope');

  useEffect(() => {
    document.title = isEdit
      ? 'Edit Discount | SubSentry'
      : 'New Discount | SubSentry';
  }, [isEdit]);

  // Load products for product scope dropdown
  useEffect(() => {
    productsService
      .getProducts({ page: 1, page_size: 100 })
      .then((res) => setProducts(res.data))
      .catch(() => {});
  }, []);

  // Load existing discount on edit
  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    discountsService
      .getDiscount(id)
      .then((data) => {
        reset({
          name: data.name,
          type: data.type,
          value: data.value,
          min_amount: data.min_amount || '0.00',
          min_quantity: data.min_quantity ? String(data.min_quantity) : '',
          max_uses: data.max_uses ? String(data.max_uses) : '',
          valid_from: data.valid_from ? data.valid_from.split('T')[0] : '',
          valid_until: data.valid_until ? data.valid_until.split('T')[0] : '',
          scope: (data.scope as 'all' | 'product' | 'subscription') || 'all',
          product_id: data.product_id ? String(data.product_id) : '',
          is_active: data.is_active ?? true,
        });
      })
      .catch((err: unknown) => {
        setServerError(getErrorMessage(err));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id, reset]);

  const onSubmit = async (formData: DiscountFormData) => {
    setIsSubmitting(true);
    setServerError(null);
    setSuccessMessage(null);

    const payload = {
      name: formData.name.trim(),
      type: formData.type as DiscountType,
      value: toMoneyString(formData.value),
      min_amount: formData.min_amount ? toMoneyString(formData.min_amount) : '0.00',
      min_quantity: formData.min_quantity ? parseInt(formData.min_quantity, 10) : null,
      max_uses: formData.max_uses ? parseInt(formData.max_uses, 10) : null,
      valid_from: formData.valid_from || null,
      valid_until: formData.valid_until || null,
      scope: formData.scope,
      product_id:
        formData.scope === 'product' && formData.product_id
          ? parseInt(formData.product_id, 10)
          : null,
      ...(isEdit ? { is_active: formData.is_active } : {}),
    };

    try {
      if (isEdit && id) {
        await discountsService.updateDiscount(id, payload);
        setSuccessMessage('Discount rule updated successfully.');
      } else {
        await discountsService.createDiscount(payload);
        navigate('/discounts');
      }
    } catch (err: unknown) {
      setServerError(getErrorMessage(err));
      const fieldErrors = getFieldErrors(err);
      Object.entries(fieldErrors).forEach(([field, msg]) => {
        if (field in formData) {
          setError(field as keyof DiscountFormData, { message: msg });
        }
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
        <p className="mt-3 text-sm text-slate-500">Loading discount details...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title={isEdit ? 'Edit Discount' : 'New Discount Rule'}
        subtitle={
          isEdit
            ? 'Modify eligibility criteria and redemption limits'
            : 'Configure discount value, minimum order criteria, and validity periods'
        }
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Discounts', href: '/discounts' },
          { label: isEdit ? 'Edit' : 'New' },
        ]}
        actions={
          <Button
            variant="secondary"
            leftIcon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate('/discounts')}
          >
            Cancel
          </Button>
        }
      />

      {serverError && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Core Discount Details */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-indigo-600" />
              <h2 className="text-sm font-semibold text-slate-900">
                Discount Specifications
              </h2>
            </div>
          </CardHeader>
          <CardBody className="p-4 space-y-4">
            <FormField
              id="discount-name"
              label="Discount Name / Code"
              error={errors.name}
              required
            >
              <input
                id="discount-name"
                type="text"
                placeholder="e.g. New Customer 10% or WELCOME2026"
                className="input text-xs"
                {...register('name')}
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField id="discount-type" label="Discount Type" error={errors.type} required>
                <select
                  id="discount-type"
                  className="input text-xs"
                  {...register('type')}
                >
                  <option value="percent">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (INR)</option>
                </select>
              </FormField>

              <FormField
                id="discount-value"
                label={selectedType === 'percent' ? 'Rate (%)' : 'Amount (INR)'}
                error={errors.value}
                required
              >
                <input
                  id="discount-value"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="e.g. 10.00"
                  className="input text-xs"
                  {...register('value')}
                />
              </FormField>
            </div>
          </CardBody>
        </Card>

        {/* Eligibility Criteria & Scope */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-900">
              Eligibility & Application Scope
            </h2>
          </CardHeader>
          <CardBody className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                id="discount-scope"
                label="Application Scope"
                error={errors.scope}
                required
              >
                <select
                  id="discount-scope"
                  className="input text-xs"
                  {...register('scope')}
                >
                  <option value="all">Entire Order / All Lines</option>
                  <option value="product">Specific Product</option>
                  <option value="subscription">Subscription Only</option>
                </select>
              </FormField>

              {selectedScope === 'product' && (
                <FormField
                  id="discount-product-id"
                  label="Select Product"
                  error={errors.product_id}
                >
                  <select
                    id="discount-product-id"
                    className="input text-xs"
                    {...register('product_id')}
                  >
                    <option value="">Select a product...</option>
                    {products.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </FormField>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                id="discount-min-amount"
                label="Min Purchase (INR)"
                error={errors.min_amount}
              >
                <input
                  id="discount-min-amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="input text-xs"
                  {...register('min_amount')}
                />
              </FormField>

              <FormField
                id="discount-min-quantity"
                label="Min Quantity"
                error={errors.min_quantity}
              >
                <input
                  id="discount-min-quantity"
                  type="number"
                  placeholder="Optional"
                  className="input text-xs"
                  {...register('min_quantity')}
                />
              </FormField>

              <FormField
                id="discount-max-uses"
                label="Max Usage Limit"
                error={errors.max_uses}
              >
                <input
                  id="discount-max-uses"
                  type="number"
                  placeholder="Unlimited"
                  className="input text-xs"
                  {...register('max_uses')}
                />
              </FormField>
            </div>
          </CardBody>
        </Card>

        {/* Validity & Active State */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-900">
              Validity Window
            </h2>
          </CardHeader>
          <CardBody className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                id="discount-valid-from"
                label="Valid From"
                error={errors.valid_from}
              >
                <input
                  id="discount-valid-from"
                  type="date"
                  className="input text-xs"
                  {...register('valid_from')}
                />
              </FormField>

              <FormField
                id="discount-valid-until"
                label="Valid Until"
                error={errors.valid_until}
              >
                <input
                  id="discount-valid-until"
                  type="date"
                  className="input text-xs"
                  {...register('valid_until')}
                />
              </FormField>
            </div>

            {isEdit && (
              <div className="pt-2 flex items-center gap-2">
                <input
                  id="discount-is-active"
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  {...register('is_active')}
                />
                <label
                  htmlFor="discount-is-active"
                  className="text-xs font-medium text-slate-700"
                >
                  Active discount (available for new orders)
                </label>
              </div>
            )}
          </CardBody>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/discounts')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isSubmitting}
            leftIcon={<Save className="h-4 w-4" />}
            id="save-discount-btn"
          >
            {isEdit ? 'Save Changes' : 'Create Discount'}
          </Button>
        </div>
      </form>
    </div>
  );
}
