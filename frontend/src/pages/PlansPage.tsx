/**
 * src/pages/PlansPage.tsx
 * Subscription Plans listing page with server-side pagination,
 * search, billing frequency filter, and role-based actions.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  CreditCard,
  Calendar,
  CheckCircle2,
  XCircle,
  Eye,
  Filter,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { plansService } from '../services/plans';
import { getErrorMessage } from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Card, CardBody } from '../components/Card';
import { DataTable } from '../components/DataTable';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { Plan, TableColumn } from '../types';

export default function PlansPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const [plans, setPlans] = useState<Plan[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedFrequency, setSelectedFrequency] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Deletion modal state
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadPlans = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await plansService.getPlans({
        page,
        page_size: pageSize,
        q: debouncedQuery.trim() || undefined,
        billing_frequency:
          selectedFrequency !== 'all' ? selectedFrequency : undefined,
      });
      setPlans(res.data);
      setTotal(res.meta.total);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedQuery, selectedFrequency]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  async function handleDelete() {
    if (!deleteId) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await plansService.deletePlan(deleteId);
      setDeleteId(null);
      await loadPlans();
    } catch (err: unknown) {
      setDeleteError(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  }

  const columns: TableColumn<Plan>[] = [
    {
      key: 'name',
      header: 'Plan Name',
      render: (_, plan) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-slate-900 flex items-center gap-2">
              <Link
                to={`/plans/${plan.id}/edit`}
                className="hover:text-primary-600 transition-colors"
              >
                {plan.name}
              </Link>
              {!plan.is_active && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Product ID: #{plan.product_id}
              {plan.min_quantity > 1 && ` • Min Qty: ${plan.min_quantity}`}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Recurring Price',
      render: (_, plan) => (
        <div>
          <span className="font-bold text-slate-900">
            {formatCurrency(plan.price)}
          </span>
          <span className="text-xs text-slate-500 ml-1">
            / {plan.billing_frequency}
          </span>
        </div>
      ),
    },
    {
      key: 'billing_frequency',
      header: 'Frequency',
      render: (_, plan) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 capitalize">
          <Calendar className="h-3 w-3 mr-1" />
          {plan.billing_frequency}
        </span>
      ),
    },
    {
      key: 'validity',
      header: 'Availability',
      render: (_, plan) => {
        if (!plan.available_from && !plan.available_until) {
          return <span className="text-xs text-slate-400">Always Available</span>;
        }
        return (
          <div className="text-xs text-slate-600">
            {plan.available_from ? formatDate(plan.available_from) : 'Immediate'}
            {' → '}
            {plan.available_until ? formatDate(plan.available_until) : 'Indefinite'}
          </div>
        );
      },
    },
    {
      key: 'features',
      header: 'Rules & Toggles',
      render: (_, plan) => (
        <div className="flex flex-wrap gap-1 text-[11px]">
          {plan.allow_early_close && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
              Early Close
            </span>
          )}
          {plan.allow_pause && (
            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">
              Pause
            </span>
          )}
          {plan.allow_renewal && (
            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
              Renewal
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (_, plan) =>
        plan.is_active ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
            <XCircle className="h-3.5 w-3.5 text-slate-400" /> Inactive
          </span>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (_, plan) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/plans/${plan.id}/edit`)}
            title={isAdmin ? 'Edit plan' : 'View plan'}
            id={`edit-plan-${plan.id}`}
          >
            {isAdmin ? (
              <Edit2 className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </Button>

          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              onClick={() => {
                setDeleteError(null);
                setDeleteId(plan.id);
              }}
              title="Deactivate plan"
              id={`delete-plan-${plan.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans"
        subtitle="Configure recurring billing frequencies, pricing rules and renewal policies"
        actions={
          isAdmin ? (
            <Button
              variant="primary"
              onClick={() => navigate('/plans/new')}
              id="add-plan-button"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Add Plan
            </Button>
          ) : undefined
        }
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Plans' },
        ]}
      />

      {/* Filter and Search Bar */}
      <Card>
        <CardBody className="p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search plans by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-9"
                id="plan-search-input"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={selectedFrequency}
                onChange={(e) => {
                  setSelectedFrequency(e.target.value);
                  setPage(1);
                }}
                className="input text-xs w-full sm:w-36"
                id="plan-frequency-filter"
              >
                <option value="all">All Frequencies</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div className="text-xs text-slate-500 self-end sm:self-center">
            Showing {plans.length} of {total} plans
          </div>
        </CardBody>
      </Card>

      {/* Delete Error Notification */}
      {deleteError && (
        <div className="alert-error" role="alert">
          <p>{deleteError}</p>
        </div>
      )}

      {/* Plans Table */}
      <DataTable<Plan>
        columns={columns}
        data={plans}
        isLoading={isLoading}
        error={error}
        onRetry={loadPlans}
        emptyTitle="No plans found"
        emptyDescription={
          debouncedQuery || selectedFrequency !== 'all'
            ? 'No plans matched the current search criteria.'
            : 'Create your first subscription plan to start billing customers.'
        }
        keyExtractor={(p) => String(p.id)}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={(newPage) => setPage(newPage)}
      />

      {/* Confirmation Dialog for Plan Deactivation */}
      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Deactivate Plan"
        message="Are you sure you want to deactivate this plan? Existing active subscriptions under this plan will remain valid until expiration."
        confirmText="Deactivate"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
