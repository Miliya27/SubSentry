/**
 * src/pages/DashboardPage.tsx
 * Admin & Staff Executive Dashboard featuring real-time KPI metrics,
 * Recharts visual analytics, upcoming renewals tracking, and insights panel.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Receipt,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  CreditCard,
  Zap,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dashboardService } from '../services/dashboard';
import { getErrorMessage } from '../services/api';
import { formatCurrency } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Card, CardBody } from '../components/Card';
import { KpiCard } from '../components/KpiCard';
import { RevenueTrendChart } from '../components/RevenueTrendChart';
import { PlanDistributionChart } from '../components/PlanDistributionChart';
import { UpcomingRenewalsTable } from '../components/UpcomingRenewalsTable';
import type { DashboardSummary } from '../types/dashboard';

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Dashboard | SubSentry';
  }, []);

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dashboardService.getSummary({
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setSummary(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Dashboard"
        subtitle="Real-time recurring revenue metrics, billing performance, and subscription lifecycle analytics"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 pl-1">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="text-xs border-0 py-1 px-1.5 focus:ring-0 text-slate-700"
                id="dash-from-date"
              />
              <span className="text-[11px] text-slate-500">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="text-xs border-0 py-1 px-1.5 focus:ring-0 text-slate-700"
                id="dash-to-date"
              />
            </div>

            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RotateCw className="h-3.5 w-3.5" />}
              onClick={loadSummary}
              disabled={isLoading}
            >
              Refresh
            </Button>

            {isAdmin && (
              <Link to="/billing/run">
                <Button
                  size="sm"
                  leftIcon={<Zap className="h-3.5 w-3.5" />}
                  id="dash-billing-run-btn"
                >
                  Billing Run
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
          <span>Failed to load dashboard summary: {error}</span>
          <Button size="sm" variant="secondary" onClick={loadSummary}>
            Retry
          </Button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Subscriptions */}
        <KpiCard
          title="Active Subscriptions"
          value={summary?.active_subscriptions ?? 0}
          subtitle="Currently generating recurring revenue"
          icon={<Users className="h-5 w-5 text-indigo-600" />}
          badgeColor="indigo"
          isLoading={isLoading}
        />

        {/* Revenue Received (Cash Collected) */}
        <KpiCard
          title="Revenue Received (Collected)"
          value={formatCurrency(summary?.revenue_received ?? '0.00')}
          subtitle="Total settlements realized in bank"
          badge="Cash In"
          badgeColor="emerald"
          icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
          isLoading={isLoading}
        />

        {/* Total Invoiced */}
        <KpiCard
          title="Total Invoiced (Billed)"
          value={formatCurrency(summary?.total_invoiced ?? '0.00')}
          subtitle="Gross billing across all confirmed cycles"
          badge="Gross"
          badgeColor="slate"
          icon={<Receipt className="h-5 w-5 text-slate-600" />}
          isLoading={isLoading}
        />

        {/* Outstanding Receivables */}
        <KpiCard
          title="Outstanding Receivables"
          value={formatCurrency(summary?.outstanding ?? '0.00')}
          subtitle="Pending customer invoice payments"
          badge="Receivable"
          badgeColor="amber"
          icon={<CreditCard className="h-5 w-5 text-amber-600" />}
          isLoading={isLoading}
        />

        {/* Overdue Amount & Count */}
        <KpiCard
          title="Overdue Receivables"
          value={formatCurrency(summary?.overdue_amount ?? '0.00')}
          subtitle={`Across ${summary?.overdue_count ?? 0} overdue invoices`}
          badge={summary?.overdue_count ? `${summary.overdue_count} overdue` : '0 overdue'}
          badgeColor={summary?.overdue_count ? 'red' : 'emerald'}
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          isLoading={isLoading}
        />

        {/* MRR */}
        <KpiCard
          title="Monthly Recurring (MRR)"
          value={formatCurrency(summary?.mrr ?? '0.00')}
          subtitle="Normalized monthly subscription run"
          badge="Normalized"
          badgeColor="indigo"
          icon={<TrendingUp className="h-5 w-5 text-indigo-600" />}
          isLoading={isLoading}
        />

        {/* ARR */}
        <KpiCard
          title="Annual Run Rate (ARR)"
          value={formatCurrency(summary?.arr ?? '0.00')}
          subtitle="12-month forward revenue projection"
          badge="Annualized"
          badgeColor="indigo"
          icon={<Sparkles className="h-5 w-5 text-indigo-600" />}
          isLoading={isLoading}
        />

        {/* Collection Efficiency */}
        <KpiCard
          title="Collection Rate"
          value={
            summary && parseFloat(summary.total_invoiced) > 0
              ? `${(
                  (parseFloat(summary.revenue_received) /
                    parseFloat(summary.total_invoiced)) *
                  100
                ).toFixed(1)}%`
              : '100%'
          }
          subtitle="Proportion of billed amount collected"
          badge="Efficiency"
          badgeColor="emerald"
          icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
          isLoading={isLoading}
        />
      </div>

      {/* Insights Panel */}
      {summary && (
        <Card className="border-indigo-100 bg-gradient-to-r from-indigo-50/40 via-white to-slate-50/30">
          <CardBody className="p-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-sm">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Business Insights & Action Items
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {summary.overdue_count > 0 ? (
                      <>
                        You have <span className="font-semibold text-red-600">{summary.overdue_count} overdue invoices</span> totaling <span className="font-mono font-semibold">{formatCurrency(summary.overdue_amount)}</span> requiring attention.
                      </>
                    ) : (
                      <>All customer accounts are current with zero overdue balances.</>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-center">
                {summary.overdue_count > 0 && (
                  <Link to="/invoices?tab=overdue">
                    <Button size="sm" variant="danger">
                      Review Overdue ({summary.overdue_count})
                    </Button>
                  </Link>
                )}
                {isAdmin && (
                  <Link to="/billing/run">
                    <Button size="sm" variant="secondary" leftIcon={<Zap className="h-3.5 w-3.5" />}>
                      Generate Invoices
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RevenueTrendChart />
        </div>
        <div className="lg:col-span-1">
          <PlanDistributionChart />
        </div>
      </div>

      {/* Upcoming Renewals Table */}
      <UpcomingRenewalsTable />
    </div>
  );
}
