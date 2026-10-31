/**
 * src/pages/InvoicesPage.tsx
 * Invoices list view with server-side pagination, search, status & payment tabs,
 * date-range filters, and direct navigation to details or print.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Eye,
  Printer,
  Zap,
  Building2,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { invoicesService } from '../services/invoices';
import { customersService } from '../services/customers';
import { getErrorMessage } from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Card, CardBody } from '../components/Card';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import type { Invoice, Customer, TableColumn } from '../types';

type InvoiceFilterTab = 'all' | 'paid' | 'outstanding' | 'partially_paid' | 'overdue';

export default function InvoicesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [activeTab, setActiveTab] = useState<InvoiceFilterTab>(
    (searchParams.get('tab') as InvoiceFilterTab) || 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Invoices | SubSentry';
  }, []);

  // Fetch customers for the dropdown filter
  useEffect(() => {
    customersService
      .getCustomers({ page: 1, page_size: 100 })
      .then((res) => setCustomers(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Parameters<typeof invoicesService.getInvoices>[0] = {
        page,
        page_size: pageSize,
        q: debouncedQuery.trim() || undefined,
        customer_id: selectedCustomer ? Number(selectedCustomer) : undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      };

      if (activeTab === 'paid') {
        params.status = 'paid';
      } else if (activeTab === 'outstanding') {
        params.payment_state = 'unpaid';
      } else if (activeTab === 'partially_paid') {
        params.payment_state = 'partially_paid';
      } else if (activeTab === 'overdue') {
        params.is_overdue = true;
      }

      const res = await invoicesService.getInvoices(params);
      setInvoices(res.data);
      setTotal(res.meta.total);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, debouncedQuery, selectedCustomer, fromDate, toDate, activeTab]);

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
      key: 'status',
      header: 'Status',
      render: (_, row) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusBadge status={row.status} />
          {row.is_overdue && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
              <AlertTriangle className="h-2.5 w-2.5" />
              Overdue
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'issue_date',
      header: 'Issue Date',
      render: (_, row) => (
        <div className="flex items-center gap-1 text-xs text-slate-600">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span>{formatDate(row.issue_date)}</span>
        </div>
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
      key: 'total',
      header: 'Total',
      render: (_, row) => (
        <span className="font-semibold text-slate-900">
          {formatCurrency(row.total)}
        </span>
      ),
    },
    {
      key: 'amount_paid',
      header: 'Paid',
      render: (_, row) => (
        <span className="text-xs text-emerald-600 font-medium">
          {formatCurrency(row.amount_paid)}
        </span>
      ),
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      render: (_, row) => (
        <span
          className={`text-xs font-semibold ${
            parseFloat(String(row.outstanding)) > 0
              ? 'text-amber-600'
              : 'text-slate-500'
          }`}
        >
          {formatCurrency(row.outstanding)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2">
          <Link
            to={`/invoices/${row.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            id={`view-invoice-${row.id}`}
          >
            <Eye className="h-3.5 w-3.5" />
            View
          </Link>
          <Link
            to={`/invoices/${row.id}/print`}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-800"
            id={`print-invoice-${row.id}`}
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </Link>
        </div>
      ),
    },
  ];

  const tabs: { key: InvoiceFilterTab; label: string }[] = [
    { key: 'all', label: 'All Invoices' },
    { key: 'paid', label: 'Paid' },
    { key: 'outstanding', label: 'Outstanding' },
    { key: 'partially_paid', label: 'Partially Paid' },
    { key: 'overdue', label: 'Overdue' },
  ];

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Manage billing statements, payments, and account receivables"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Invoices' },
        ]}
        actions={
          user?.role === 'admin' ? (
            <Button
              leftIcon={<Zap className="h-4 w-4" />}
              onClick={() => navigate('/billing/run')}
              id="billing-run-button"
            >
              Billing Run
            </Button>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="mb-4 border-b border-slate-200">
        <nav className="flex space-x-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setPage(1);
              }}
              className={`pb-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters & Search */}
      <Card className="mb-4">
        <CardBody className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoice #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-9 text-xs"
                id="invoice-search-input"
              />
            </div>

            <div>
              <select
                value={selectedCustomer}
                onChange={(e) => {
                  setSelectedCustomer(e.target.value);
                  setPage(1);
                }}
                className="input text-xs"
                id="invoice-customer-filter"
              >
                <option value="">All Customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                className="input text-xs py-1"
                id="invoice-from-filter"
              />
            </div>

            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                className="input text-xs py-1"
                id="invoice-to-filter"
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Invoices Data Table */}
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
        emptyDescription="Invoices will appear once billing runs execute or orders are confirmed."
      />
    </div>
  );
}
