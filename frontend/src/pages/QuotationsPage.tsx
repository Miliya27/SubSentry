/**
 * src/pages/QuotationsPage.tsx
 * Quotations list view: displays subscriptions with status draft or quotation.
 * Includes status filter, search, server-side pagination, and navigation to templates.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Eye,
  FileSpreadsheet,
  Calendar,
  Building2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { subscriptionsService } from '../services/subscriptions';
import { getErrorMessage } from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import type { Subscription, TableColumn } from '../types';

export default function QuotationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canCreate = user?.role === 'admin' || user?.role === 'staff';

  const [quotations, setQuotations] = useState<Subscription[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'quotation'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Quotations | SubSentry';
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadQuotations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // If a specific status is chosen, pass that. Otherwise if "all",
      // the contract allows passing status or fetching all and filtering.
      const statusParam = statusFilter === 'all' ? undefined : statusFilter;
      const res = await subscriptionsService.getSubscriptions({
        page,
        page_size: pageSize,
        q: debouncedQuery.trim() || undefined,
        status: statusParam,
      });

      // If statusFilter is 'all', filter in memory for draft & quotation statuses
      if (statusFilter === 'all') {
        const filtered = res.data.filter(
          (s) => s.status === 'draft' || s.status === 'quotation'
        );
        setQuotations(filtered);
        setTotal(filtered.length);
      } else {
        setQuotations(res.data);
        setTotal(res.meta.total);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, debouncedQuery, statusFilter]);

  useEffect(() => {
    loadQuotations();
  }, [loadQuotations]);

  const columns: TableColumn<Subscription>[] = [
    {
      key: 'subscription_number',
      header: 'Quotation #',
      render: (_, row) => (
        <span className="font-mono text-xs font-semibold text-indigo-600">
          {row.subscription_number}
        </span>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
          <span className="font-medium text-slate-900">
            {row.customer?.company_name || `Customer #${row.customer_id}`}
          </span>
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      render: (_, row) => (
        <span className="text-slate-700 font-medium">
          {row.plan?.name || `Plan #${row.plan_id}`}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (_, row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'start_date',
      header: 'Start Date',
      render: (_, row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span>{formatDate(row.start_date)}</span>
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Total Amount',
      render: (_, row) => (
        <span className="font-semibold text-slate-900">
          {formatCurrency(row.total)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2">
          <Link
            to={`/subscriptions/${row.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            id={`view-quotation-${row.id}`}
          >
            <Eye className="h-3.5 w-3.5" />
            Review
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Quotations"
        subtitle="Review draft and proposed subscriptions prior to activation"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Quotations' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/quotations/templates">
              <Button
                variant="secondary"
                leftIcon={<FileSpreadsheet className="h-4 w-4" />}
                id="manage-templates-button"
              >
                Templates
              </Button>
            </Link>
            {canCreate && (
              <Button
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => navigate('/subscriptions/new')}
                id="create-quotation-button"
              >
                New Quotation
              </Button>
            )}
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="mb-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          {(['all', 'draft', 'quotation'] as const).map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === st
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st === 'all' ? 'All Quotations' : st.charAt(0).toUpperCase() + st.slice(1)}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search quotations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9 text-xs"
            id="quotations-search-input"
          />
        </div>
      </div>

      <DataTable<Subscription>
        data={quotations}
        columns={columns}
        keyExtractor={(row) => String(row.id)}
        isLoading={isLoading}
        error={error}
        onRetry={loadQuotations}
        totalPages={Math.ceil(total / pageSize)}
        currentPage={page}
        onPageChange={setPage}
        emptyTitle="No quotations found"
        emptyDescription="Create a quotation or draft a subscription to get started."
      />
    </div>
  );
}
