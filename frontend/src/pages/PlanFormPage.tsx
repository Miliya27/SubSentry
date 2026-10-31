/**
 * src/pages/PlanFormPage.tsx
 * Plan Create and Edit page with Product selection, frequency options,
 * date range constraints (available_until >= available_from), and policy toggles.
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  ArrowLeft,
  Save,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Settings,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { plansService } from '../services/plans';
import { productsService } from '../services/products';
import { getErrorMessage, getFieldErrors } from '../services/api';
import { formatCurrency, toMoneyString } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Card, CardHeader, CardBody } from '../components/Card';
import { Spinner } from '../components/Spinner';
import type { Plan, Product, BillingFrequency } from '../types';

interface PlanFormData {
  name: string;
  product_id: string; // string in form select, converted to number
  price: string;
  billing_frequency: BillingFrequency;
  min_quantity: number;
  trial_days: number;
  available_from: string;
  available_until: string;
  auto_close_days: string;
  allow_early_close: boolean;
  allow_pause: boolean;
  allow_renewal: boolean;
  is_active: boolean;
}

export default function PlanFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isEdit = Boolean(id);

  const [isLoading, setIsLoading] = useState(isEdit);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PlanFormData>({
    defaultValues: {
      name: '',
      product_id: '',
      price: '2000.00',
      billing_frequency: 'monthly',
      min_quantity: 1,
      trial_days: 0,
      available_from: '',
      available_until: '',
      auto_close_days: '',
      allow_early_close: true,
      allow_pause: true,
      allow_renewal: true,
      is_active: true,
    },
  });

  const availableFrom = watch('available_from');

  // Load products list for dropdown
  useEffect(() => {
    async function loadProductOptions() {
      try {
        const res = await productsService.getProducts({ page_size: 100 });
        setProducts(res.data);
      } catch (err: unknown) {
        console.error('Failed to load products list:', err);
      } finally {
        setLoadingProducts(false);
      }
    }
    loadProductOptions();
  }, []);

  // Fetch plan if in edit mode
  const fetchPlan = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setServerError(null);
    try {
      const data = await plansService.getPlan(id);
      setPlan(data);
      reset({
        name: data.name,
        product_id: String(data.product_id),
        price: data.price,
        billing_frequency: data.billing_frequency,
        min_quantity: data.min_quantity,
        trial_days: data.trial_days || 0,
        available_from: data.available_from || '',
        available_until: data.available_until || '',
        auto_close_days: data.auto_close_days ? String(data.auto_close_days) : '',
        allow_early_close: data.allow_early_close,
        allow_pause: data.allow_pause,
        allow_renewal: data.allow_renewal,
        is_active: data.is_active,
      });
    } catch (err: unknown) {
      setServerError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [id, reset]);

  useEffect(() => {
    if (isEdit) {
      fetchPlan();
    }
  }, [isEdit, fetchPlan]);

  // Submit plan form
  async function onSubmit(data: PlanFormData) {
    if (!isAdmin) return;
    setServerError(null);
    setSaveSuccess(false);

    // Client-side date comparison rule: available_until must be >= available_from
    if (data.available_from && data.available_until) {
      if (data.available_until < data.available_from) {
        setError('available_until', {
          type: 'manual',
          message: 'Available until date must be on or after Available from date.',
        });
        return;
      }
    }

    if (data.min_quantity < 1) {
      setError('min_quantity', {
        type: 'manual',
        message: 'Minimum quantity must be at least 1.',
      });
      return;
    }

    const priceNum = parseFloat(data.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      setError('price', {
        type: 'manual',
        message: 'Price must be greater than 0.00.',
      });
      return;
    }

    const payload = {
      name: data.name.trim(),
      product_id: parseInt(data.product_id, 10),
      price: toMoneyString(data.price),
      billing_frequency: data.billing_frequency,
      min_quantity: Number(data.min_quantity),
      trial_days: Number(data.trial_days || 0),
      available_from: data.available_from || null,
      available_until: data.available_until || null,
      auto_close_days: data.auto_close_days
        ? parseInt(data.auto_close_days, 10)
        : null,
      allow_early_close: data.allow_early_close,
      allow_pause: data.allow_pause,
      allow_renewal: data.allow_renewal,
    };

    try {
      if (isEdit && id) {
        const updated = await plansService.updatePlan(id, {
          ...payload,
          is_active: data.is_active,
        });
        setPlan(updated);
        setSaveSuccess(true);
      } else {
        await plansService.createPlan(payload);
        navigate('/plans', { replace: true });
      }
    } catch (err: unknown) {
      const fieldErrors = getFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        for (const [field, message] of Object.entries(fieldErrors)) {
          setError(field as keyof PlanFormData, {
            type: 'server',
            message,
          });
        }
      } else {
        setServerError(getErrorMessage(err));
      }
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
        title={isEdit ? `Edit Plan: ${plan?.name || ''}` : 'New Subscription Plan'}
        subtitle={
          isEdit
            ? 'Adjust pricing, billing intervals, renewal rules, and date validity'
            : 'Configure recurring pricing terms and link to a catalog product'
        }
        actions={
          <Button
            variant="secondary"
            onClick={() => navigate('/plans')}
            id="back-to-plans-button"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Plans
          </Button>
        }
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Plans', href: '/plans' },
          { label: isEdit ? 'Edit' : 'New' },
        ]}
      />

      {serverError && (
        <div className="alert-error" role="alert" id="plan-form-error-alert">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p className="flex-1">{serverError}</p>
        </div>
      )}

      {saveSuccess && (
        <div className="alert-success" role="status" id="plan-saved-alert">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p className="flex-1">Plan updated successfully.</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {/* General & Pricing Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary-600" />
              <h2 className="text-base font-bold text-slate-900">
                Plan & Pricing Terms
              </h2>
            </div>
            {!isAdmin && (
              <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-medium">
                Read-only mode
              </span>
            )}
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Plan Name */}
              <div className="md:col-span-2">
                <label className="label" htmlFor="plan-name-input">
                  Plan Name *
                </label>
                <input
                  id="plan-name-input"
                  type="text"
                  placeholder="e.g. Pro Monthly Plan"
                  disabled={!isAdmin}
                  className={`input ${errors.name ? 'input-error' : ''}`}
                  {...register('name', { required: 'Plan name is required' })}
                />
                {errors.name && (
                  <p className="error-msg">{errors.name.message}</p>
                )}
              </div>

              {/* Product Select */}
              <div className="md:col-span-2">
                <label className="label" htmlFor="plan-product-select">
                  Associated Product *
                </label>
                <div className="relative">
                  <select
                    id="plan-product-select"
                    disabled={!isAdmin || loadingProducts}
                    className={`input ${errors.product_id ? 'input-error' : ''}`}
                    {...register('product_id', {
                      required: 'Product selection is required',
                    })}
                  >
                    <option value="">-- Select a product --</option>
                    {products.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name} ({formatCurrency(p.sales_price)}) — {p.product_type}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.product_id && (
                  <p className="error-msg">{errors.product_id.message}</p>
                )}
              </div>

              {/* Price */}
              <div>
                <label className="label" htmlFor="plan-price-input">
                  Recurring Price (INR) *
                </label>
                <input
                  id="plan-price-input"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="2000.00"
                  disabled={!isAdmin}
                  className={`input ${errors.price ? 'input-error' : ''}`}
                  {...register('price', { required: 'Price is required' })}
                />
                {errors.price && (
                  <p className="error-msg">{errors.price.message}</p>
                )}
              </div>

              {/* Billing Frequency */}
              <div>
                <label className="label" htmlFor="plan-frequency-select">
                  Billing Frequency *
                </label>
                <select
                  id="plan-frequency-select"
                  disabled={!isAdmin}
                  className="input"
                  {...register('billing_frequency')}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              {/* Minimum Quantity */}
              <div>
                <label className="label" htmlFor="plan-min-quantity-input">
                  Minimum Quantity *
                </label>
                <input
                  id="plan-min-quantity-input"
                  type="number"
                  min="1"
                  disabled={!isAdmin}
                  className={`input ${errors.min_quantity ? 'input-error' : ''}`}
                  {...register('min_quantity', {
                    valueAsNumber: true,
                    min: { value: 1, message: 'Minimum quantity must be at least 1' },
                  })}
                />
                {errors.min_quantity && (
                  <p className="error-msg">{errors.min_quantity.message}</p>
                )}
              </div>

              {/* Trial Days */}
              <div>
                <label className="label" htmlFor="plan-trial-days-input">
                  Trial Days (0 for no trial)
                </label>
                <input
                  id="plan-trial-days-input"
                  type="number"
                  min="0"
                  disabled={!isAdmin}
                  className="input"
                  {...register('trial_days', { valueAsNumber: true })}
                />
              </div>

              {/* Auto Close Days */}
              <div>
                <label className="label" htmlFor="plan-auto-close-input">
                  Auto-Close After (Days)
                </label>
                <input
                  id="plan-auto-close-input"
                  type="number"
                  min="1"
                  placeholder="Leave empty for indefinite duration"
                  disabled={!isAdmin}
                  className="input"
                  {...register('auto_close_days')}
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Automatically terminates subscription after this duration.
                </span>
              </div>

              {/* Active Toggle (Edit mode) */}
              {isEdit && (
                <div className="flex items-center gap-3 pt-6">
                  <input
                    id="plan-active-toggle"
                    type="checkbox"
                    disabled={!isAdmin}
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    {...register('is_active')}
                  />
                  <label
                    htmlFor="plan-active-toggle"
                    className="text-sm font-medium text-slate-700 cursor-pointer"
                  >
                    Active for new subscriptions
                  </label>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Availability Period Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">
                Availability Window
              </h3>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="plan-available-from-input">
                  Available From (Optional)
                </label>
                <input
                  id="plan-available-from-input"
                  type="date"
                  disabled={!isAdmin}
                  className="input"
                  {...register('available_from')}
                />
              </div>

              <div>
                <label className="label" htmlFor="plan-available-until-input">
                  Available Until (Optional)
                </label>
                <input
                  id="plan-available-until-input"
                  type="date"
                  min={availableFrom || undefined}
                  disabled={!isAdmin}
                  className={`input ${errors.available_until ? 'input-error' : ''}`}
                  {...register('available_until')}
                />
                {errors.available_until && (
                  <p className="error-msg">{errors.available_until.message}</p>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Subscription Policies Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">
                Subscription Policies
              </h3>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  {...register('allow_early_close')}
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    Allow Early Close
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Customers can close subscriptions before the natural expiry.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  {...register('allow_pause')}
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    Allow Pause
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Subscriptions can be temporarily paused and resumed.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  {...register('allow_renewal')}
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    Allow Renewal
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Allows extending expiration upon cycle completion.
                  </span>
                </div>
              </label>
            </div>

            {isAdmin && (
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting}
                  id="save-plan-button"
                >
                  {isSubmitting ? (
                    <>
                      <Spinner size="sm" className="mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1.5" />
                      {isEdit ? 'Save Changes' : 'Create Plan'}
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
