/**
 * src/pages/BillingRunPage.tsx
 * Admin-only Billing Execution interface per docs/API_CONTRACT.md (§8.8).
 * Supports preview dry-runs and execution with created/skipped/failed metrics.
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Zap,
  Eye,
  Play,
  CheckCircle,
  XCircle,
  Calendar,
  ArrowLeft,
} from 'lucide-react';
import { billingService } from '../services/billing';
import { getErrorMessage } from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Card, CardHeader, CardBody } from '../components/Card';
import type { BillingPreviewData, BillingRunResult } from '../types';

export default function BillingRunPage() {
  const navigate = useNavigate();

  // "as of date" defaults to today YYYY-MM-DD
  const today = new Date().toISOString().split('T')[0];
  const [asOfDate, setAsOfDate] = useState<string>(today);

  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [previewData, setPreviewData] = useState<BillingPreviewData | null>(null);
  const [runResult, setRunResult] = useState<BillingRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Billing Run | SubSentry';
  }, []);

  // Handle dry-run preview
  const handlePreview = async () => {
    if (!asOfDate) return;
    setIsPreviewing(true);
    setError(null);
    setRunResult(null);
    setSuccessMessage(null);
    try {
      const data = await billingService.previewBilling({ as_of: asOfDate });
      setPreviewData(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsPreviewing(false);
    }
  };

  // Handle execution run
  const handleRun = async () => {
    if (!asOfDate) return;
    setIsRunning(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await billingService.runBilling({ as_of_date: asOfDate });
      setRunResult(result);
      setSuccessMessage(
        `Billing run complete: ${result.created} invoices created, ${result.skipped} skipped, ${result.failed} failed.`
      );
      // Automatically refresh preview
      try {
        const previewAfter = await billingService.previewBilling({ as_of: asOfDate });
        setPreviewData(previewAfter);
      } catch {
        // non-fatal
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Billing Run"
        subtitle="Generate automated cycle invoices for active subscriptions as of a given cutoff date"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Invoices', href: '/invoices' },
          { label: 'Billing Run' },
        ]}
        actions={
          <Button
            variant="secondary"
            leftIcon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate('/invoices')}
          >
            Back to Invoices
          </Button>
        }
      />

      {/* Control Panel */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-slate-900">Run Configuration</h2>
          </div>
        </CardHeader>
        <CardBody className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
            <div className="flex-1 max-w-xs">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                As of Date (Cutoff)
              </label>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="input text-xs"
                id="billing-as-of-date-input"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Invoices will generate for subscriptions due on or before this date.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                leftIcon={<Eye className="h-4 w-4" />}
                onClick={handlePreview}
                isLoading={isPreviewing}
                disabled={isRunning}
                id="billing-preview-btn"
              >
                Preview Run
              </Button>

              <Button
                leftIcon={<Play className="h-4 w-4" />}
                onClick={handleRun}
                isLoading={isRunning}
                disabled={isPreviewing}
                id="billing-execute-btn"
              >
                Execute Billing Run
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Status Notifications */}
      {error && (
        <div className="mb-6 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <XCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div className="mb-6 flex items-center gap-2 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Execution Results Banner */}
      {runResult && (
        <Card className="mb-6 border-indigo-200 bg-indigo-50/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-900">Run Output Summary</h3>
            </div>
          </CardHeader>
          <CardBody className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <span className="text-xs text-slate-500 font-medium">Invoices Created</span>
                <p className="text-2xl font-bold text-emerald-600 mt-1" id="invoices-created-count">
                  {runResult.created}
                </p>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <span className="text-xs text-slate-500 font-medium">Skipped</span>
                <p className="text-2xl font-bold text-slate-600 mt-1" id="invoices-skipped-count">
                  {runResult.skipped}
                </p>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <span className="text-xs text-slate-500 font-medium">Failed</span>
                <p className="text-2xl font-bold text-red-600 mt-1" id="invoices-failed-count">
                  {runResult.failed}
                </p>
              </div>
            </div>

            {/* Generated Invoice IDs */}
            {runResult.invoice_ids && runResult.invoice_ids.length > 0 && (
              <div className="mt-3">
                <span className="text-xs font-semibold text-slate-700">
                  Generated Invoice IDs:
                </span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {runResult.invoice_ids.map((invId) => (
                    <Link
                      key={invId}
                      to={`/invoices/${invId}`}
                      className="px-2 py-0.5 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded font-mono text-xs font-medium"
                    >
                      INV #{invId}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Errors List */}
            {runResult.errors && runResult.errors.length > 0 && (
              <div className="mt-4 p-3 bg-red-100/60 border border-red-200 rounded text-xs text-red-800">
                <span className="font-semibold block mb-1">Errors Encountered:</span>
                <ul className="list-disc pl-4 space-y-0.5">
                  {runResult.errors.map((err, idx) => (
                    <li key={idx}>{typeof err === 'string' ? err : JSON.stringify(err)}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Preview Section */}
      {previewData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Preview: Dry-run Subscriptions
                </h3>
              </div>
              <div className="text-xs text-slate-500">
                Would create: <span className="font-bold text-emerald-600">{previewData.would_create}</span> • Would skip: <span className="font-bold text-slate-700">{previewData.would_skip}</span>
              </div>
            </div>
          </CardHeader>
          <CardBody className="p-0 overflow-x-auto">
            {previewData.subscriptions && previewData.subscriptions.length > 0 ? (
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Subscription</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Customer ID</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Next Billing Date</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-600">Cycle Total</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {previewData.subscriptions.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3 font-semibold text-indigo-600">
                        <Link to={`/subscriptions/${s.id}`} className="hover:underline">
                          Subscription #{s.id}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-700">Customer #{s.customer_id}</td>
                      <td className="px-4 py-3 text-slate-700">{formatDate(s.next_billing_date)}</td>
                      <td className="px-4 py-3 text-right font-semibold font-mono text-slate-900">
                        {formatCurrency(s.total)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/subscriptions/${s.id}`}
                          className="text-xs text-indigo-600 hover:text-indigo-800"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                No subscriptions are due for billing as of {formatDate(asOfDate)}.
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
