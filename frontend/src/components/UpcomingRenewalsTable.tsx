/**
 * src/components/UpcomingRenewalsTable.tsx
 * Table component displaying renewals due in the next 30 days (§8.13).
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Building2, AlertCircle, RotateCw } from 'lucide-react';
import { Card, CardHeader, CardBody } from './Card';
import { dashboardService } from '../services/dashboard';
import { getErrorMessage } from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import type { UpcomingRenewalItem } from '../types/dashboard';

export function UpcomingRenewalsTable() {
  const [items, setItems] = useState<UpcomingRenewalItem[]>([]);
  const [days, setDays] = useState(30);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRenewals = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dashboardService.getUpcomingRenewals({ days });
      setItems(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRenewals();
  }, [days]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Upcoming Renewals ({days} Days)
            </h3>
          </div>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="input text-xs py-1 px-2 w-28"
            id="upcoming-renewals-days-select"
          >
            <option value={7}>Next 7 days</option>
            <option value={14}>Next 14 days</option>
            <option value={30}>Next 30 days</option>
          </select>
        </div>
      </CardHeader>
      <CardBody className="p-0 overflow-x-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-red-600 bg-red-50/50">
            <AlertCircle className="h-6 w-6 mx-auto text-red-400 mb-1" />
            <p>Failed to load upcoming renewals</p>
            <button
              onClick={loadRenewals}
              className="mt-2 text-indigo-600 hover:underline inline-flex items-center gap-1 font-medium"
            >
              <RotateCw className="h-3 w-3" /> Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No renewals scheduled in the next {days} days.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Subscription</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Plan</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Renewal Date</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Cycle Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((r) => (
                <tr key={r.subscription_id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-indigo-600">
                    <Link to={`/subscriptions/${r.subscription_id}`} className="hover:underline">
                      Subscription #{r.subscription_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                      <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{r.customer_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.plan_name}</td>
                  <td className="px-4 py-3 text-slate-700 font-medium">
                    {formatDate(r.next_billing_date)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                    {formatCurrency(r.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardBody>
    </Card>
  );
}
