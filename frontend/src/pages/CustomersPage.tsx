/**
 * src/pages/CustomersPage.tsx
 * Customer accounts management with server-side pagination, search, and credit limits.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  UserPlus,
  Search,
  Edit2,
  Building2,
  Mail,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { customersService } from '../services/customers';
import { getErrorMessage } from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Card, CardBody } from '../components/Card';
import { DataTable } from '../components/DataTable';
import type { Customer, TableColumn } from '../types';

export default function CustomersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEdit = user?.role === 'admin' || user?.role === 'staff';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await customersService.getCustomers({
        page,
        page_size: pageSize,
        q: debouncedQuery.trim() || undefined,
      });
      setCustomers(res.data);
      setTotal(res.meta.total);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedQuery]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const columns: TableColumn<Customer>[] = [
    {
      key: 'company_name',
      header: 'Customer / Company',
      render: (_, c) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <Link
              to={`/customers/${c.id}/edit`}
              className="font-bold text-slate-900 hover:text-primary-600 transition-colors block truncate max-w-xs"
            >
              {c.company_name}
            </Link>
            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span>{c.user?.full_name}</span>
              {c.user?.email && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {c.user.email}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'gstin',
      header: 'GSTIN',
      render: (_, c) => (
        <span className="text-xs font-mono text-slate-600">
          {c.gstin || '—'}
        </span>
      ),
    },
    {
      key: 'credit_limit',
      header: 'Credit Limit',
      render: (_, c) => (
        <div className="text-xs font-semibold text-slate-900">
          {formatCurrency(c.credit_limit)}
        </div>
      ),
    },
    {
      key: 'outstanding_balance',
      header: 'Outstanding',
      render: (_, c) => {
        const balance = parseFloat(c.outstanding_balance || '0');
        return (
          <div
            className={`text-xs font-bold ${
              balance > 0 ? 'text-amber-600' : 'text-slate-600'
            }`}
          >
            {formatCurrency(c.outstanding_balance)}
          </div>
        );
      },
    },
    {
      key: 'created_at',
      header: 'Joined Date',
      render: (_, c) => (
        <span className="text-xs text-slate-500">{formatDate(c.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (_, c) => (
        <div className="flex items-center justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/customers/${c.id}/edit`)}
            title="Edit customer details"
            id={`edit-customer-${c.id}`}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        subtitle="Manage customer profiles, billing addresses, and credit limits"
        actions={
          canEdit ? (
            <Button
              variant="primary"
              onClick={() => navigate('/customers/new')}
              id="add-customer-button"
            >
              <UserPlus className="h-4 w-4 mr-1.5" /> Add Customer
            </Button>
          ) : undefined
        }
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Customers' },
        ]}
      />

      <Card>
        <CardBody className="p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by company, email, GSTIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9"
              id="customer-search-input"
            />
          </div>
          <div className="text-xs text-slate-500 self-end sm:self-center">
            Showing {customers.length} of {total} customers
          </div>
        </CardBody>
      </Card>

      <DataTable<Customer>
        columns={columns}
        data={customers}
        isLoading={isLoading}
        error={error}
        onRetry={loadCustomers}
        emptyTitle="No customers registered"
        emptyDescription={
          debouncedQuery
            ? 'No customer matched your search terms.'
            : 'Add a customer profile to start generating quotations and subscriptions.'
        }
        keyExtractor={(c) => String(c.id)}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={(p) => setPage(p)}
      />
    </div>
  );
}
