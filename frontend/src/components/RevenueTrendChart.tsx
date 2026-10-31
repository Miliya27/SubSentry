/**
 * src/components/RevenueTrendChart.tsx
 * Recharts-powered monthly revenue trend (Invoiced vs Received).
 * Handles isolated error states and loading skeletons.
 */
import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { TrendingUp, AlertCircle, RotateCw } from 'lucide-react';
import { Card, CardHeader, CardBody } from './Card';
import { dashboardService } from '../services/dashboard';
import { getErrorMessage } from '../services/api';
import { formatCurrency } from '../utils/format';
import type { RevenueTrendItem } from '../types/dashboard';

export function RevenueTrendChart() {
  const [data, setData] = useState<RevenueTrendItem[]>([]);
  const [months, setMonths] = useState(6);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await dashboardService.getRevenueTrend({ months });
      setData(items);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [months]);

  // Transform data for Recharts (convert string money to numbers)
  const chartData = data.map((d) => ({
    month: d.month,
    Invoiced: parseFloat(d.invoiced || '0'),
    Received: parseFloat(d.received || '0'),
  }));

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Revenue Trend (Invoiced vs Received)
            </h3>
          </div>
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="input text-xs py-1 px-2 w-28"
            id="revenue-trend-months-select"
          >
            <option value={3}>Last 3 mos</option>
            <option value={6}>Last 6 mos</option>
            <option value={12}>Last 12 mos</option>
          </select>
        </div>
      </CardHeader>
      <CardBody className="p-4">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="w-full h-full animate-pulse bg-slate-100 rounded-lg" />
          </div>
        ) : error ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-4 bg-red-50/50 rounded-lg">
            <AlertCircle className="h-8 w-8 text-red-400 mb-2" />
            <p className="text-xs text-red-600 font-medium">Failed to load trend chart</p>
            <button
              onClick={loadData}
              className="mt-2 text-xs text-indigo-600 hover:underline inline-flex items-center gap-1 font-medium"
            >
              <RotateCw className="h-3 w-3" /> Retry
            </button>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-xs text-slate-400">
            No billing transactions recorded in this period.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip
                  formatter={(val: unknown) => [
                    formatCurrency(typeof val === 'number' ? val : 0),
                    '',
                  ]}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Bar dataKey="Invoiced" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Received" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
