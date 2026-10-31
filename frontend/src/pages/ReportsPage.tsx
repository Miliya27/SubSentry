/**
 * src/pages/ReportsPage.tsx
 * Revenue and financial reporting interface per docs/API_CONTRACT.md (§8.14).
 * Supports period filtering, grouped breakdown, and CSV export.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Download,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react';
import { dashboardService } from '../services/dashboard';
import { getErrorMessage } from '../services/api';
import { formatCurrency } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Card, CardHeader, CardBody } from '../components/Card';
import { Spinner } from '../components/Spinner';
import type { RevenueReportItem } from '../types/dashboard';

export default function ReportsPage() {
  const now = new Date();
  const defaultTo = now.toISOString().split('T')[0];
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(now.getMonth() - 6);
  const defaultFrom = sixMonthsAgo.toISOString().split('T')[0];

  const [fromDate, setFromDate] = useState<string>(defaultFrom);
  const [toDate, setToDate] = useState<string>(defaultTo);
  const [groupBy, setGroupBy] = useState<'month' | 'week' | 'day'>('month');

  const [reportData, setReportData] = useState<RevenueReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    document.title = 'Financial Reports | SubSentry';
  }, []);

  const loadReport = useCallback(async () => {
    if (!fromDate || !toDate) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await dashboardService.getRevenueReport({
        from: fromDate,
        to: toDate,
        group_by: groupBy,
      });
      setReportData(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate, groupBy]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleDownloadCsv = async () => {
    setIsDownloading(true);
    try {
      const blob = await dashboardService.downloadInvoicesCsv({
        from: fromDate,
        to: toDate,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoices_${fromDate}_to_${toDate}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      alert(`CSV Export failed: ${getErrorMessage(err)}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Financial Reports"
        subtitle="Revenue recognition, invoice settlement reconciliation, and audit export"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Reports' },
        ]}
        actions={
          <Button
            leftIcon={<Download className="h-4 w-4" />}
            onClick={handleDownloadCsv}
            isLoading={isDownloading}
            id="download-invoices-csv-btn"
          >
            Export Invoices CSV
          </Button>
        }
      />

      {/* Filter Bar */}
      <Card className="mb-6">
        <CardBody className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="input text-xs"
                id="report-from-date"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="input text-xs"
                id="report-to-date"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Group By
              </label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as 'month' | 'week' | 'day')}
                className="input text-xs"
                id="report-group-by"
              >
                <option value="month">Monthly</option>
                <option value="week">Weekly</option>
                <option value="day">Daily</option>
              </select>
            </div>

            <div>
              <Button
                variant="secondary"
                className="w-full"
                onClick={loadReport}
                disabled={isLoading}
              >
                Update Report
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {error && (
        <div className="mb-6 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Revenue Breakdown Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Revenue Settlement Breakdown
            </h3>
          </div>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-12 flex justify-center items-center">
              <Spinner size="lg" />
            </div>
          ) : reportData.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              No financial activity recorded in the specified timeframe.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Period</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Total Invoiced</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Revenue Received</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Outstanding</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Collection Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {reportData.map((row, idx) => {
                  const invoicedNum = parseFloat(row.invoiced || '0');
                  const receivedNum = parseFloat(row.received || '0');
                  const collectionRate =
                    invoicedNum > 0 ? ((receivedNum / invoicedNum) * 100).toFixed(1) : '100';

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-semibold text-slate-900 font-sans">
                        {row.period}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {formatCurrency(row.invoiced)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600">
                        {formatCurrency(row.received)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-amber-600">
                        {formatCurrency(row.outstanding)}
                      </td>
                      <td className="px-4 py-3 text-right font-sans">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {collectionRate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
