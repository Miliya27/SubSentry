/**
 * src/pages/MyInvoicesPage.tsx (customer role)
 * Customer billing statement history with direct print views.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { invoicesService } from '../services/invoices';
import { getErrorMessage } from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import type { Invoice, TableColumn } from '../types';

export default function MyInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'My Invoices | SubSentry';
  }, []);

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await invoicesService.getInvoices({
        page,
        page_size: pageSize,
      });
      setInvoices(res.data);
      setTotal(res.meta.total);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const columns: TableColumn<Invoice>[] = [
    {
      key: 'invoice_number',
      header: 'Invoice #',
      render: (_, row) => (
        <span className="font-mono text-xs font-semibold text-indigo-600">
          {row.invoice_number}
        </span>
      ),
    },
    {
      key: 'issue_date',
      header: 'Issue Date',
      render: (_, row) => (
        <span className="text-xs text-slate-600">{formatDate(row.issue_date)}</span>
      ),
    },
    {
      key: 'due_date',
      header: 'Due Date',
      render: (_, row) => (
        <span className="text-xs text-slate-600">{formatDate(row.due_date)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (_, row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'total',
      header: 'Total',
      render: (_, row) => (
        <span className="font-mono font-semibold text-slate-900">
          {formatCurrency(row.total)}
        </span>
      ),
    },
    {
      key: 'amount_paid',
      header: 'Amount Paid',
      render: (_, row) => (
        <span className="font-mono text-emerald-600 font-medium">
          {formatCurrency(row.amount_paid)}
        </span>
      ),
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      render: (_, row) => (
        <span className="font-mono font-semibold text-amber-600">
          {formatCurrency(row.outstanding)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (_, row) => (
        <div className="flex items-center justify-end">
          <Link
            to={`/invoices/${row.id}/print`}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            id={`print-my-invoice-${row.id}`}
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="My Invoices"
        subtitle="Review your billing history, tax breakdown, and download receipts"
        breadcrumbs={[
          { label: 'Portal', href: '/portal' },
          { label: 'My Invoices' },
        ]}
      />

      <DataTable<Invoice>
        columns={columns}
        data={invoices}
        keyExtractor={(row) => String(row.id)}
        isLoading={isLoading}
        error={error}
        onRetry={loadInvoices}
        totalPages={Math.ceil(total / pageSize)}
        currentPage={page}
        onPageChange={setPage}
        emptyTitle="No invoices found"
        emptyDescription="You currently do not have any invoices issued."
      />
    </div>
  );
}
