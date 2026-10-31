/**
 * src/components/PlanDistributionChart.tsx
 * Recharts PieChart showing subscription distribution across plans.
 * Handles isolated error state and loading skeleton.
 */
import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import { PieChart as PieIcon, AlertCircle, RotateCw } from 'lucide-react';
import { Card, CardHeader, CardBody } from './Card';
import { dashboardService } from '../services/dashboard';
import { getErrorMessage } from '../services/api';
import type { PlanDistributionItem } from '../types/dashboard';

const COLORS = ['#4f46e5', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'];

export function PlanDistributionChart() {
  const [data, setData] = useState<PlanDistributionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await dashboardService.getPlanDistribution();
      setData(items);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const chartData = data.map((d) => ({
    name: d.plan_name,
    value: d.count,
    percentage: d.percentage,
  }));

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <PieIcon className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-900">
            Plan Distribution
          </h3>
        </div>
      </CardHeader>
      <CardBody className="p-4">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="w-48 h-48 rounded-full animate-pulse bg-slate-100" />
          </div>
        ) : error ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-4 bg-red-50/50 rounded-lg">
            <AlertCircle className="h-8 w-8 text-red-400 mb-2" />
            <p className="text-xs text-red-600 font-medium">Failed to load plan breakdown</p>
            <button
              onClick={loadData}
              className="mt-2 text-xs text-indigo-600 hover:underline inline-flex items-center gap-1 font-medium"
            >
              <RotateCw className="h-3 w-3" /> Retry
            </button>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-xs text-slate-400">
            No active subscriptions available to display.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: unknown, name: unknown, item: any) => [
                    `${value ?? 0} subs (${item.payload.percentage}%)`,
                    String(name),
                  ]}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
