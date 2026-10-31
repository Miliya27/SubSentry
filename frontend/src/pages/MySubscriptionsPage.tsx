/**
 * src/pages/MySubscriptionsPage.tsx (customer role)
 * Customer view of their personal subscriptions.
 */
import { useState, useEffect, useCallback } from 'react';
import { subscriptionsService } from '../services/subscriptions';
import { getErrorMessage } from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import type { Subscription, TableColumn } from '../types';

export default function MySubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'My Subscriptions | SubSentry';
  }, []);

  const loadSubscriptions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await subscriptionsService.getSubscriptions({
        page,
        page_size: pageSize,
      });
      setSubscriptions(res.data);
      setTotal(res.meta.total);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  const columns: TableColumn<Subscription>[] = [
    {
      key: 'subscription_number',
      header: 'Subscription #',
      render: (_, row) => (
        <span className="font-mono text-xs font-semibold text-indigo-600">
          {row.subscription_number}
        </span>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      render: (_, row) => (
        <span className="font-semibold text-slate-900">
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
        <span className="text-xs text-slate-600">{formatDate(row.start_date)}</span>
      ),
    },
    {
      key: 'next_billing_date',
      header: 'Next Renewal',
      render: (_, row) => (
        <span className="text-xs text-slate-700 font-medium">
          {row.next_billing_date ? formatDate(row.next_billing_date) : '—'}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Amount',
      render: (_, row) => (
        <span className="font-bold text-slate-900 font-mono">
          {formatCurrency(row.total)}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="My Subscriptions"
        subtitle="Manage and view all your active and previous subscription plans"
        breadcrumbs={[
          { label: 'Portal', href: '/portal' },
          { label: 'My Subscriptions' },
        ]}
      />

      <DataTable<Subscription>
        columns={columns}
        data={subscriptions}
        keyExtractor={(row) => String(row.id)}
        isLoading={isLoading}
        error={error}
        onRetry={loadSubscriptions}
        totalPages={Math.ceil(total / pageSize)}
        currentPage={page}
        onPageChange={setPage}
        emptyTitle="No subscriptions found"
        emptyDescription="You do not have any subscription plans active at this time."
      />
    </div>
  );
}
