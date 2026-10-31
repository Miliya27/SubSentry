/**
 * src/pages/PaymentsPage.tsx
 * Payments audit list with payment method filters, date-range selectors,
 * and server-side pagination per docs/API_CONTRACT.md (§8.12).
 */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { paymentsService } from '../services/payments';
import { getErrorMessage } from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { Card, CardBody } from '../components/Card';
import { DataTable } from '../components/DataTable';
import type { TableColumn } from '../types';
import type { PaymentItem } from '../types/payment';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Payments | SubSentry';
  }, []);

  const loadPayments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await paymentsService.getPayments({
        page,
        page_size: pageSize,
        method: methodFilter === 'all' ? undefined : methodFilter,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setPayments(res.data);
      setTotal(res.meta.total);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, methodFilter, fromDate, toDate]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const columns: TableColumn<PaymentItem>[] = [
    {
      key: 'payment_date',
      header: 'Payment Date',
      render: (_, row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-700">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span>{formatDate(row.payment_date || row.created_at)}</span>
        </div>
      ),
    },
    {
      key: 'invoice_id',
      header: 'Invoice',
      render: (_, row) => (
        <Link
          to={`/invoices/${row.invoice_id}`}
          className="font-mono text-xs font-semibold text-indigo-600 hover:underline"
        >
          {row.invoice?.invoice_number || `INV #${row.invoice_id}`}
        </Link>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      render: (_, row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 uppercase tracking-wide">
          {String(row.method).replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (_, row) => (
        <span className="font-mono text-xs text-slate-600">
          {row.reference || '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount Paid',
      render: (_, row) => (
        <span className="font-semibold text-emerald-600 font-mono">
          {formatCurrency(row.amount)}
        </span>
      ),
    },
    {
      key: 'notes',
      header: 'Notes',
      render: (_, row) => (
        <span className="text-xs text-slate-500 max-w-xs truncate block">
          {row.notes || '—'}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Review recorded customer transactions, settlement receipts, and audit trail"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Payments' },
        ]}
      />

      {/* Filter Bar */}
      <Card className="mb-4">
        <CardBody className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Payment Method
              </label>
              <select
                value={methodFilter}
                onChange={(e) => {
                  setMethodFilter(e.target.value);
                  setPage(1);
                }}
                className="input text-xs"
                id="payment-method-filter"
              >
                <option value="all">All Methods</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                className="input text-xs"
                id="payment-from-filter"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                className="input text-xs"
                id="payment-to-filter"
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Payments Data Table */}
      <DataTable<PaymentItem>
        columns={columns}
        data={payments}
        keyExtractor={(row) => String(row.id)}
        isLoading={isLoading}
        error={error}
        onRetry={loadPayments}
        totalPages={Math.ceil(total / pageSize)}
        currentPage={page}
        onPageChange={setPage}
        emptyTitle="No payment records found"
        emptyDescription="Recorded customer invoice payments will be listed here."
      />
    </div>
  );
}
