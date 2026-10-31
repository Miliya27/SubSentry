/**
 * src/pages/DiscountsPage.tsx
 * Admin-only Discounts management page conforming to docs/API_CONTRACT.md (§8.11).
 * Displays usage counts, limit-reached/expired badges, and full CRUD.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Tag,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { discountsService } from '../services/discounts';
import { getErrorMessage } from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { DataTable } from '../components/DataTable';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { TableColumn } from '../types';
import type { Discount } from '../types/discount';

export default function DiscountsPage() {
  const navigate = useNavigate();

  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Discount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    document.title = 'Discounts | SubSentry';
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadDiscounts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await discountsService.getDiscounts({
        page,
        page_size: pageSize,
        q: debouncedQuery.trim() || undefined,
      });
      setDiscounts(res.data);
      setTotal(res.meta.total);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, debouncedQuery]);

  useEffect(() => {
    loadDiscounts();
  }, [loadDiscounts]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await discountsService.deleteDiscount(deleteTarget.id);
      setActionSuccess(`Discount "${deleteTarget.name}" deactivated.`);
      setDeleteTarget(null);
      await loadDiscounts();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: TableColumn<Discount>[] = [
    {
      key: 'name',
      header: 'Discount Name',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-indigo-600 shrink-0" />
          <span className="font-semibold text-slate-900">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (_, row) => (
        <span className="text-xs uppercase font-medium text-slate-700">
          {row.type === 'percent' ? 'Percentage' : 'Fixed Amount'}
        </span>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      render: (_, row) => (
        <span className="font-mono font-semibold text-slate-900">
          {row.type === 'percent' ? `${row.value}%` : formatCurrency(row.value)}
        </span>
      ),
    },
    {
      key: 'usage',
      header: 'Usage',
      render: (_, row) => {
        const used = row.uses_count ?? row.usage_count ?? 0;
        const max = row.max_uses;
        return (
          <span className="text-xs text-slate-600 font-mono">
            {used} {max ? `/ ${max}` : 'uses'}
          </span>
        );
      },
    },
    {
      key: 'validity',
      header: 'Validity Period',
      render: (_, row) => (
        <div className="flex items-center gap-1 text-xs text-slate-600">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span>
            {row.valid_from ? formatDate(row.valid_from) : 'Immediate'}
            {' → '}
            {row.valid_until ? formatDate(row.valid_until) : 'No Expiry'}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (_, row) => {
        const used = row.uses_count ?? row.usage_count ?? 0;
        const isLimitReached = row.max_uses ? used >= row.max_uses : false;
        const isExpired = row.valid_until
          ? new Date(row.valid_until) < new Date()
          : false;

        if (isExpired) {
          return (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
              Expired
            </span>
          );
        }
        if (isLimitReached) {
          return (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
              Limit Reached
            </span>
          );
        }
        if (!row.is_active) {
          return (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
              Inactive
            </span>
          );
        }
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
            Active
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2">
          <Link
            to={`/discounts/${row.id}/edit`}
            className="p-1 text-slate-500 hover:text-indigo-600 rounded"
            title="Edit discount"
            id={`edit-discount-${row.id}`}
          >
            <Edit2 className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => setDeleteTarget(row)}
            className="p-1 text-slate-500 hover:text-red-600 rounded"
            title="Deactivate discount"
            id={`delete-discount-${row.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Discounts"
        subtitle="Manage promotional discount rules and coupon incentives"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Discounts' },
        ]}
        actions={
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => navigate('/discounts/new')}
            id="add-discount-button"
          >
            New Discount
          </Button>
        }
      />

      {/* Notifications banner */}
      {actionSuccess && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search Input */}
      <div className="mb-4 flex justify-between items-center">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search discounts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9 text-xs"
            id="search-discounts-input"
          />
        </div>
      </div>

      {/* Discounts Data Table */}
      <DataTable<Discount>
        columns={columns}
        data={discounts}
        keyExtractor={(row) => String(row.id)}
        isLoading={isLoading}
        error={error}
        onRetry={loadDiscounts}
        totalPages={Math.ceil(total / pageSize)}
        currentPage={page}
        onPageChange={setPage}
        emptyTitle="No discounts configured"
        emptyDescription="Create discount rules to apply fixed or percentage savings to orders."
      />

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Deactivate Discount"
          message={`Are you sure you want to deactivate discount "${deleteTarget.name}"? Existing applied orders will retain their amounts.`}
          confirmText="Deactivate"
          variant="danger"
          isLoading={isDeleting}
        />
      )}
    </div>
  );
}
