/**
 * src/pages/CustomerFormPage.tsx
 * Customer profile creation and editing form.
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  ArrowLeft,
  Save,
  Building2,
  AlertCircle,
  CheckCircle2,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { customersService } from '../services/customers';
import { getErrorMessage, getFieldErrors } from '../services/api';
import { toMoneyString } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Card, CardHeader, CardBody } from '../components/Card';
import { Spinner } from '../components/Spinner';
import type { Customer, User } from '../types';

interface CustomerFormData {
  user_id: string;
  company_name: string;
  gstin: string;
  billing_address: string;
  shipping_address: string;
  credit_limit: string;
}

export default function CustomerFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = Boolean(id);
  const canEdit = user?.role === 'admin' || user?.role === 'staff';

  const [isLoading, setIsLoading] = useState(isEdit);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(!isEdit);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormData>({
    defaultValues: {
      user_id: '',
      company_name: '',
      gstin: '',
      billing_address: '',
      shipping_address: '',
      credit_limit: '50000.00',
    },
  });

  // Load available users if in create mode
  useEffect(() => {
    if (!isEdit) {
      async function loadUsers() {
        try {
          const res = await customersService.getUsers({ page_size: 100 });
          setAvailableUsers(res.data);
        } catch (err: unknown) {
          console.error('Failed to load users for customer creation:', err);
        } finally {
          setLoadingUsers(false);
        }
      }
      loadUsers();
    }
  }, [isEdit]);

  // Fetch customer details if in edit mode
  const fetchCustomer = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setServerError(null);
    try {
      const data = await customersService.getCustomer(id);
      setCustomer(data);
      reset({
        user_id: String(data.user_id),
        company_name: data.company_name,
        gstin: data.gstin || '',
        billing_address: data.billing_address,
        shipping_address: data.shipping_address || '',
        credit_limit: data.credit_limit,
      });
    } catch (err: unknown) {
      setServerError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [id, reset]);

  useEffect(() => {
    if (isEdit) {
      fetchCustomer();
    }
  }, [isEdit, fetchCustomer]);

  async function onSubmit(data: CustomerFormData) {
    if (!canEdit) return;
    setServerError(null);
    setSaveSuccess(false);

    try {
      if (isEdit && id) {
        const updated = await customersService.updateCustomer(id, {
          company_name: data.company_name.trim(),
          gstin: data.gstin.trim() || null,
          billing_address: data.billing_address.trim(),
          shipping_address: data.shipping_address.trim() || null,
          credit_limit: toMoneyString(data.credit_limit),
        });
        setCustomer(updated);
        setSaveSuccess(true);
      } else {
        await customersService.createCustomer({
          user_id: parseInt(data.user_id, 10),
          company_name: data.company_name.trim(),
          gstin: data.gstin.trim() || null,
          billing_address: data.billing_address.trim(),
          shipping_address: data.shipping_address.trim() || null,
          credit_limit: toMoneyString(data.credit_limit),
        });
        navigate('/customers', { replace: true });
      }
    } catch (err: unknown) {
      const fieldErrors = getFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        for (const [field, message] of Object.entries(fieldErrors)) {
          setError(field as keyof CustomerFormData, {
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
        title={
          isEdit
            ? `Edit Customer: ${customer?.company_name || ''}`
            : 'New Customer Profile'
        }
        subtitle={
          isEdit
            ? 'Update customer organization information, billing address, and credit rules'
            : 'Link a registered user to a corporate or individual customer account'
        }
        actions={
          <Button
            variant="secondary"
            onClick={() => navigate('/customers')}
            id="back-to-customers-button"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Customers
          </Button>
        }
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Customers', href: '/customers' },
          { label: isEdit ? 'Edit' : 'New' },
        ]}
      />

      {serverError && (
        <div className="alert-error" role="alert" id="customer-form-error-alert">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p className="flex-1">{serverError}</p>
        </div>
      )}

      {saveSuccess && (
        <div className="alert-success" role="status" id="customer-saved-alert">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p className="flex-1">Customer profile updated successfully.</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {/* Linked User Information Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">
                User Account Link
              </h2>
            </div>
          </CardHeader>
          <CardBody>
            {isEdit && customer?.user ? (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Full Name:</span>
                  <span className="font-semibold text-slate-900">
                    {customer.user.full_name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Email Address:</span>
                  <span className="font-semibold text-slate-900">
                    {customer.user.email}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Phone:</span>
                  <span className="font-semibold text-slate-900">
                    {customer.user.phone || '—'}
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <label className="label" htmlFor="customer-user-id-select">
                  Select User Account *
                </label>
                <select
                  id="customer-user-id-select"
                  disabled={loadingUsers}
                  className={`input ${errors.user_id ? 'input-error' : ''}`}
                  {...register('user_id', {
                    required: 'User account selection is required',
                  })}
                >
                  <option value="">-- Choose registered user --</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.full_name} ({u.email}) — Role: {u.role}
                    </option>
                  ))}
                </select>
                {errors.user_id && (
                  <p className="error-msg">{errors.user_id.message}</p>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Company & Billing Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary-600" />
              <h2 className="text-base font-bold text-slate-900">
                Company & Billing Details
              </h2>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="customer-company-input">
                  Company Name *
                </label>
                <input
                  id="customer-company-input"
                  type="text"
                  placeholder="e.g. Acme Pvt Ltd"
                  className={`input ${errors.company_name ? 'input-error' : ''}`}
                  {...register('company_name', {
                    required: 'Company name is required',
                  })}
                />
                {errors.company_name && (
                  <p className="error-msg">{errors.company_name.message}</p>
                )}
              </div>

              <div>
                <label className="label" htmlFor="customer-gstin-input">
                  GSTIN
                </label>
                <input
                  id="customer-gstin-input"
                  type="text"
                  placeholder="29ABCDE1234F1Z5"
                  className="input"
                  {...register('gstin')}
                />
              </div>

              <div className="md:col-span-2">
                <label className="label" htmlFor="customer-credit-limit-input">
                  Credit Limit (INR)
                </label>
                <input
                  id="customer-credit-limit-input"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="50000.00"
                  className="input"
                  {...register('credit_limit')}
                />
              </div>

              <div className="md:col-span-2">
                <label className="label" htmlFor="customer-billing-address-input">
                  Billing Address *
                </label>
                <textarea
                  id="customer-billing-address-input"
                  rows={2}
                  placeholder="123 MG Road, Bengaluru, Karnataka"
                  className={`input ${errors.billing_address ? 'input-error' : ''}`}
                  {...register('billing_address', {
                    required: 'Billing address is required',
                  })}
                />
                {errors.billing_address && (
                  <p className="error-msg">{errors.billing_address.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="label" htmlFor="customer-shipping-address-input">
                  Shipping Address (Optional)
                </label>
                <textarea
                  id="customer-shipping-address-input"
                  rows={2}
                  placeholder="Leave empty if same as billing address"
                  className="input"
                  {...register('shipping_address')}
                />
              </div>
            </div>

            {canEdit && (
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting}
                  id="save-customer-button"
                >
                  {isSubmitting ? (
                    <>
                      <Spinner size="sm" className="mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1.5" />
                      {isEdit ? 'Save Changes' : 'Create Customer'}
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
