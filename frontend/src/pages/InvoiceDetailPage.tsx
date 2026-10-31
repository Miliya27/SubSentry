/**
 * src/pages/InvoiceDetailPage.tsx
 * Comprehensive invoice detail view with legal lifecycle transitions,
 * lines breakdown, payment history, and payment recording modal.
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Send,
  Printer,
  CreditCard,
  Building2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Layers,
  Receipt,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { invoicesService } from '../services/invoices';
import { getErrorMessage } from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Card, CardHeader, CardBody } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import { Spinner } from '../components/Spinner';
import type { Invoice } from '../types';

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'staff';

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Modals state
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const loadInvoice = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await invoicesService.getInvoice(id);
      setInvoice(data);
      document.title = `${data.invoice_number} | SubSentry`;
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  // Transition actions
  const handleConfirm = async () => {
    if (!id) return;
    setIsProcessing(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await invoicesService.confirmInvoice(id);
      setActionSuccess('Invoice confirmed successfully.');
      await loadInvoice();
    } catch (err: unknown) {
      setActionError(getErrorMessage(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!id) return;
    setIsProcessing(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await invoicesService.cancelInvoice(id);
      setActionSuccess('Invoice cancelled.');
      setIsCancelConfirmOpen(false);
      await loadInvoice();
    } catch (err: unknown) {
      setActionError(getErrorMessage(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSend = async () => {
    if (!id) return;
    setIsProcessing(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await invoicesService.sendInvoice(id);
      setActionSuccess(res.message || 'Invoice emailed to customer.');
    } catch (err: unknown) {
      setActionError(getErrorMessage(err));
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
        <p className="mt-3 text-sm text-slate-500">Loading invoice details...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <p className="font-semibold">Unable to load invoice</p>
          <p className="text-sm mt-1">{error || 'Invoice not found.'}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/invoices')}
            className="mt-3"
          >
            Back to Invoices
          </Button>
        </div>
      </div>
    );
  }

  // Legal transitions per state machine §6.2
  const isDraft = invoice.status === 'draft';
  const isConfirmed = invoice.status === 'confirmed';
  const isPaid = invoice.status === 'paid';
  const numOutstanding = parseFloat(invoice.outstanding || '0');
  const numPaid = parseFloat(invoice.amount_paid || '0');

  // Can cancel only if draft, or confirmed with NO payments
  const canCancel =
    canManage &&
    (isDraft || (isConfirmed && numPaid === 0 && (!invoice.payments || invoice.payments.length === 0)));

  return (
    <div>
      <PageHeader
        title={invoice.invoice_number}
        subtitle={`Issued on ${formatDate(invoice.issue_date)} • Due ${formatDate(invoice.due_date)}`}
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Invoices', href: '/invoices' },
          { label: invoice.invoice_number },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="secondary"
              leftIcon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => navigate('/invoices')}
            >
              Back
            </Button>

            {/* Print button */}
            <Link to={`/invoices/${invoice.id}/print`}>
              <Button
                variant="secondary"
                leftIcon={<Printer className="h-4 w-4" />}
                id="print-invoice-btn"
              >
                Print View
              </Button>
            </Link>

            {/* Send button (legal for confirmed or paid) */}
            {canManage && (isConfirmed || isPaid) && (
              <Button
                variant="secondary"
                leftIcon={<Send className="h-4 w-4" />}
                onClick={handleSend}
                disabled={isProcessing}
                id="send-invoice-btn"
              >
                Send to Customer
              </Button>
            )}

            {/* Confirm button (legal for draft only) */}
            {canManage && isDraft && (
              <Button
                leftIcon={<CheckCircle className="h-4 w-4" />}
                onClick={handleConfirm}
                disabled={isProcessing}
                id="confirm-invoice-btn"
              >
                Confirm Invoice
              </Button>
            )}

            {/* Record Payment button (legal for confirmed with outstanding > 0) */}
            {canManage && isConfirmed && numOutstanding > 0 && (
              <Button
                leftIcon={<CreditCard className="h-4 w-4" />}
                onClick={() => setIsPaymentModalOpen(true)}
                id="record-payment-btn"
              >
                Record Payment
              </Button>
            )}

            {/* Cancel button (with confirm dialog) */}
            {canCancel && (
              <Button
                variant="danger"
                leftIcon={<XCircle className="h-4 w-4" />}
                onClick={() => setIsCancelConfirmOpen(true)}
                disabled={isProcessing}
                id="cancel-invoice-btn"
              >
                Cancel Invoice
              </Button>
            )}
          </div>
        }
      />

      {/* Notifications banner */}
      {actionError && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardBody className="p-4">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Status
            </span>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge status={invoice.status} />
              {invoice.is_overdue && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
                  Overdue
                </span>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Amount
            </span>
            <div className="mt-2 text-xl font-bold text-slate-900">
              {formatCurrency(invoice.total)}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Amount Paid
            </span>
            <div className="mt-2 text-xl font-bold text-emerald-600">
              {formatCurrency(invoice.amount_paid)}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Outstanding Balance
            </span>
            <div
              className={`mt-2 text-xl font-bold ${
                numOutstanding > 0 ? 'text-amber-600' : 'text-slate-500'
              }`}
            >
              {formatCurrency(invoice.outstanding)}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Customer Information */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-indigo-600" />
              <h2 className="text-sm font-semibold text-slate-900">Customer Details</h2>
            </div>
          </CardHeader>
          <CardBody className="p-4 text-xs space-y-2">
            <div>
              <span className="text-slate-500">Company Name:</span>
              <p className="font-semibold text-slate-900 mt-0.5">
                {invoice.customer?.company_name || `Customer #${invoice.customer_id}`}
              </p>
            </div>
            {invoice.customer?.gstin && (
              <div>
                <span className="text-slate-500">GSTIN:</span>
                <p className="font-mono text-slate-800 mt-0.5">{invoice.customer.gstin}</p>
              </div>
            )}
            <div>
              <span className="text-slate-500">Billing Address:</span>
              <p className="text-slate-800 mt-0.5 whitespace-pre-line">
                {invoice.customer?.billing_address || 'No address provided'}
              </p>
            </div>
            {invoice.customer?.user && (
              <div>
                <span className="text-slate-500">Contact:</span>
                <p className="text-slate-800 mt-0.5">
                  {invoice.customer.user.full_name} ({invoice.customer.user.email})
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Invoice Metadata */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-600" />
              <h2 className="text-sm font-semibold text-slate-900">Billing Schedule</h2>
            </div>
          </CardHeader>
          <CardBody className="p-4 text-xs grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-slate-500">Issue Date</span>
              <p className="font-medium text-slate-900 mt-1">{formatDate(invoice.issue_date)}</p>
            </div>
            <div>
              <span className="text-slate-500">Due Date</span>
              <p className="font-medium text-slate-900 mt-1">{formatDate(invoice.due_date)}</p>
            </div>
            {invoice.period_start && (
              <div>
                <span className="text-slate-500">Period Start</span>
                <p className="font-medium text-slate-900 mt-1">{formatDate(invoice.period_start)}</p>
              </div>
            )}
            {invoice.period_end && (
              <div>
                <span className="text-slate-500">Period End</span>
                <p className="font-medium text-slate-900 mt-1">{formatDate(invoice.period_end)}</p>
              </div>
            )}
            {invoice.subscription_id && (
              <div>
                <span className="text-slate-500">Linked Subscription</span>
                <p className="mt-1">
                  <Link
                    to={`/subscriptions/${invoice.subscription_id}`}
                    className="text-indigo-600 hover:underline font-semibold"
                  >
                    Subscription #{invoice.subscription_id}
                  </Link>
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Invoice Line Items */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-slate-900">Line Items</h2>
          </div>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Description</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Quantity</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Unit Price</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Discount</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {invoice.lines && invoice.lines.length > 0 ? (
                invoice.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 text-slate-900 font-medium">{l.description}</td>
                    <td className="px-4 py-3 text-right text-slate-700 font-mono">{l.quantity}</td>
                    <td className="px-4 py-3 text-right text-slate-700 font-mono">
                      {formatCurrency(l.unit_price)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700 font-mono">
                      {formatCurrency(l.discount)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900 font-semibold font-mono">
                      {formatCurrency(l.line_total)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    No line items specified.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Totals Summary */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
            <div className="w-full sm:w-64 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-900 font-mono">
                  {formatCurrency(invoice.subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tax Amount:</span>
                <span className="font-semibold text-slate-900 font-mono">
                  {formatCurrency(invoice.tax_amount)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Discount:</span>
                <span className="font-semibold text-slate-900 font-mono">
                  - {formatCurrency(invoice.discount_amount)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-300 flex justify-between text-sm font-bold text-slate-900">
                <span>Total:</span>
                <span className="text-indigo-600 font-mono">{formatCurrency(invoice.total)}</span>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-indigo-600" />
              <h2 className="text-sm font-semibold text-slate-900">Recorded Payments</h2>
            </div>
            {canManage && isConfirmed && numOutstanding > 0 && (
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<CreditCard className="h-3.5 w-3.5" />}
                onClick={() => setIsPaymentModalOpen(true)}
              >
                Record Payment
              </Button>
            )}
          </div>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          {invoice.payments && invoice.payments.length > 0 ? (
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Method</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Reference</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Notes</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoice.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDate(p.payment_date || p.paid_at || p.created_at)}
                    </td>
                    <td className="px-4 py-3 font-medium uppercase text-slate-800">
                      {String(p.payment_method).replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono">
                      {p.transaction_id || p.payment_reference || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.notes || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600 font-mono">
                      {formatCurrency(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6 text-center text-xs text-slate-400">
              No payments recorded yet for this invoice.
            </div>
          )}
        </CardBody>
      </Card>

      {/* Confirm Dialog for Invoice Cancellation */}
      <ConfirmDialog
        isOpen={isCancelConfirmOpen}
        onClose={() => setIsCancelConfirmOpen(false)}
        onConfirm={handleCancel}
        title="Cancel Invoice"
        message={`Are you sure you want to cancel invoice ${invoice.invoice_number}? This cannot be undone.`}
        confirmText="Yes, Cancel Invoice"
        variant="danger"
        isLoading={isProcessing}
      />

      {/* Record Payment Modal */}
      {invoice && (
        <RecordPaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoice_number}
          outstanding={invoice.outstanding}
          onSuccess={() => {
            setActionSuccess('Payment recorded successfully.');
            loadInvoice();
          }}
        />
      )}
    </div>
  );
}
