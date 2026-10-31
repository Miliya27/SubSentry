/**
 * src/pages/CustomerPortalPage.tsx
 * Customer Self-Service Portal (/portal) per docs/API_CONTRACT.md (§8.13 GET /dashboard/customer).
 * Provides the customer with immediate visibility into their subscriptions, outstanding invoices,
 * and direct one-click print links.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  Receipt,
  DollarSign,
  CreditCard,
  Printer,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dashboardService } from '../services/dashboard';
import { subscriptionsService } from '../services/subscriptions';
import { invoicesService } from '../services/invoices';
import { getErrorMessage } from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { Card, CardHeader, CardBody } from '../components/Card';
import { KpiCard } from '../components/KpiCard';
import { StatusBadge } from '../components/StatusBadge';
import { Spinner } from '../components/Spinner';
import type { CustomerDashboardData } from '../types/dashboard';
import type { Subscription, Invoice } from '../types';

export default function CustomerPortalPage() {
  const { user } = useAuth();

  const [metrics, setMetrics] = useState<CustomerDashboardData | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Customer Portal | SubSentry';
  }, []);

  useEffect(() => {
    async function loadPortalData() {
      setIsLoading(true);
      setError(null);
      try {
        const [metricData, subData, invData] = await Promise.all([
          dashboardService.getCustomerDashboard().catch(() => null),
          subscriptionsService.getSubscriptions({ page: 1, page_size: 20 }),
          invoicesService.getInvoices({ page: 1, page_size: 20 }),
        ]);

        setMetrics(metricData);
        setSubscriptions(subData.data);
        setInvoices(invData.data);
      } catch (err: unknown) {
        setError(getErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    loadPortalData();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${user?.full_name || 'Customer'}`}
        subtitle="View your active subscriptions, billing statements, and download invoices"
        breadcrumbs={[{ label: 'Home', href: '/portal' }, { label: 'Customer Portal' }]}
      />

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <span>Failed to load portal information: {error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Active Subscriptions"
          value={metrics?.active_subscriptions ?? subscriptions.filter((s) => s.status === 'active').length}
          subtitle="Plans currently running"
          icon={<Layers className="h-5 w-5 text-indigo-600" />}
          badgeColor="indigo"
          isLoading={isLoading}
        />

        <KpiCard
          title="Total Invoiced"
          value={formatCurrency(metrics?.total_invoiced ?? '0.00')}
          subtitle="Cumulative billing charges"
          icon={<Receipt className="h-5 w-5 text-slate-600" />}
          isLoading={isLoading}
        />

        <KpiCard
          title="Total Paid"
          value={formatCurrency(metrics?.amount_paid ?? '0.00')}
          subtitle="Settled balance"
          badgeColor="emerald"
          icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
          isLoading={isLoading}
        />

        <KpiCard
          title="Outstanding Due"
          value={formatCurrency(metrics?.outstanding ?? '0.00')}
          subtitle={
            metrics?.next_renewal
              ? `Next billing: ${formatDate(metrics.next_renewal)}`
              : 'All balances settled'
          }
          badge={parseFloat(metrics?.outstanding || '0') > 0 ? 'Due' : 'Current'}
          badgeColor={parseFloat(metrics?.outstanding || '0') > 0 ? 'amber' : 'emerald'}
          icon={<CreditCard className="h-5 w-5 text-amber-600" />}
          isLoading={isLoading}
        />
      </div>

      {/* My Subscriptions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-slate-900">My Subscriptions</h2>
          </div>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-6 flex justify-center">
              <Spinner size="md" />
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              You do not have any active subscriptions yet.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Subscription #</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Plan</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Next Billing Date</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {subscriptions.map((sub) => (
                  <tr key={sub.id}>
                    <td className="px-4 py-3 font-mono font-semibold text-indigo-600">
                      {sub.subscription_number}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {sub.plan?.name || `Plan #${sub.plan_id}`}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {sub.next_billing_date ? formatDate(sub.next_billing_date) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(sub.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {/* My Invoices Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-slate-900">My Invoices & Receipts</h2>
          </div>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-6 flex justify-center">
              <Spinner size="md" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No invoices generated yet for your account.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Invoice #</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Issue Date</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Due Date</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Total</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Paid</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Outstanding</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-3 font-mono font-semibold text-indigo-600">
                      {inv.invoice_number}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(inv.issue_date)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(inv.due_date)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-900">
                      {formatCurrency(inv.total)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-600">
                      {formatCurrency(inv.amount_paid)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-amber-600">
                      {formatCurrency(inv.outstanding)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/invoices/${inv.id}/print`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        title="Print or save as PDF"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Print
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
