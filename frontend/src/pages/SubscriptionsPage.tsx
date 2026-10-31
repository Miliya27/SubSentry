/**
 * src/pages/SubscriptionsPage.tsx
 * Subscriptions list with server-side pagination, status filters, search, and lifecycle links.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Eye,
  Receipt,
  Calendar,
  Building2,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { subscriptionsService } from '../services/subscriptions';
import { getErrorMessage } from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Card, CardBody } from '../components/Card';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import type { Subscription, TableColumn } from '../types';

export default function SubscriptionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const canCreate = user?.role === 'admin' || user?.role === 'staff';

  const initialStatus = searchParams.get('status') || 'all';

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatus);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadSubscriptions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await subscriptionsService.getSubscriptions({
        page,
        page_size: pageSize,
        q: debouncedQuery.trim() || undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
      });
      setSubscriptions(res.data);
      setTotal(res.meta.total);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedQuery, selectedStatus]);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  function handleStatusChange(status: string) {
    setSelectedStatus(status);
    setPage(1);
    if (status === 'all') {
      searchParams.delete('status');
    } else {
      searchParams.set('status', status);
    }
    setSearchParams(searchParams);
  }

  const columns: TableColumn<Subscription>[] = [
    {
      key: 'subscription_number',
      header: 'Subscription #',
      render: (_, sub) => (
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <Receipt className="h-4 w-4" />
          </div>
          <div>
            <Link
              to={`/subscriptions/${sub.id}`}
              className="font-bold text-slate-900 hover:text-primary-600 font-mono text-xs block"
            >
              {sub.subscription_number || `SUB-#${sub.id}`}
            </Link>
            <span className="text-[11px] text-slate-400">
              ID: {sub.id}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'customer_id',
      header: 'Customer',
      render: (_, sub) => (
        <div className="text-xs">
          <span className="font-semibold text-slate-800 flex items-center gap-1">
            <Building2 className="h-3 w-3 text-slate-400" />
            {sub.customer?.company_name || `Customer #${sub.customer_id}`}
          </span>
          {sub.customer?.user?.email && (
            <span className="text-slate-400 block text-[11px]">
              {sub.customer.user.email}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'plan_id',
      header: 'Plan',
      render: (_, sub) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
          {sub.plan?.name || `Plan #${sub.plan_id}`}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (_, sub) => <StatusBadge status={sub.status} />,
    },
    {
      key: 'dates',
      header: 'Billing Cycle',
      render: (_, sub) => (
        <div className="text-xs text-slate-600">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-slate-400" />
            <span>{formatDate(sub.start_date)}</span>
            <span className="text-slate-400">→</span>
            <span>{sub.expiry_date ? formatDate(sub.expiry_date) : 'Ongoing'}</span>
          </div>
          {sub.next_billing_date && (
            <span className="text-[11px] text-indigo-600 block mt-0.5 font-medium">
              Next Bill: {formatDate(sub.next_billing_date)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Cycle Amount',
      render: (_, sub) => (
        <span className="font-bold text-slate-900 text-xs">
          {formatCurrency(sub.total)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (_, sub) => (
        <div className="flex items-center justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/subscriptions/${sub.id}`)}
            title="View details & lifecycle"
            id={`view-sub-${sub.id}`}
          >
            <Eye className="h-3.5 w-3.5 mr-1" /> View
          </Button>
        </div>
      ),
    },
  ];

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        subtitle="Track active accounts, manage renewals, and process lifecycle transitions"
        actions={
          canCreate ? (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => navigate('/quotations/templates')}
              >
                <FileText className="h-4 w-4 mr-1.5" /> Templates
              </Button>
              <Button
                variant="primary"
                onClick={() => navigate('/subscriptions/new')}
                id="add-subscription-button"
              >
                <Plus className="h-4 w-4 mr-1.5" /> New Subscription
              </Button>
            </div>
          ) : undefined
        }
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Subscriptions' },
        ]}
      />

      <Card>
        <CardBody className="p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by number, customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-9"
                id="sub-search-input"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={selectedStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="input text-xs w-full sm:w-36"
                id="sub-status-filter"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="quotation">Quotation</option>
                <option value="confirmed">Confirmed</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          <div className="text-xs text-slate-500 self-end sm:self-center">
            Showing {subscriptions.length} of {total} subscriptions
          </div>
        </CardBody>
      </Card>

      <DataTable<Subscription>
        columns={columns}
        data={subscriptions}
        isLoading={isLoading}
        error={error}
        onRetry={loadSubscriptions}
        emptyTitle="No subscriptions found"
        emptyDescription={
          debouncedQuery || selectedStatus !== 'all'
            ? 'No subscriptions match your query.'
            : 'Initiate a new subscription or send a quotation to get started.'
        }
        keyExtractor={(s) => String(s.id)}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={(p) => setPage(p)}
      />
    </div>
  );
}
