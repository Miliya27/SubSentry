/**
 * src/pages/InvoicePrintPage.tsx
 * Printable invoice layout rendered per docs/API_CONTRACT.md (§8.9 GET /invoices/{id}/print).
 * Conforms to clean A4 page layout with window.print() trigger.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import { invoicesService } from '../services/invoices';
import { getErrorMessage } from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import { Button } from '../components/Button';
import { Spinner } from '../components/Spinner';
import type { InvoicePrintData } from '../types';
import '../styles/print.css';

export default function InvoicePrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [printData, setPrintData] = useState<InvoicePrintData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    invoicesService
      .getInvoicePrint(id)
      .then((data) => {
        setPrintData(data);
        document.title = `Print ${data.invoice?.invoice_number || 'Invoice'} | SubSentry`;
      })
      .catch((err: unknown) => {
        setError(getErrorMessage(err));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
        <p className="mt-3 text-sm text-slate-500">Preparing print document...</p>
      </div>
    );
  }

  if (error || !printData) {
    return (
      <div className="p-8 max-w-lg mx-auto">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <p className="font-semibold">Unable to load invoice print data</p>
          <p className="mt-1">{error || 'Invoice not found.'}</p>
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

  const { invoice, customer, lines, payments, tax_breakdown } = printData;

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 sm:px-6">
      {/* Top Action Bar (hidden on print) */}
      <div className="max-w-4xl mx-auto mb-4 flex items-center justify-between no-print">
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate(`/invoices/${invoice.id}`)}
        >
          Back to Invoice
        </Button>

        <Button
          leftIcon={<Printer className="h-4 w-4" />}
          onClick={() => window.print()}
          id="trigger-print-btn"
        >
          Print Invoice
        </Button>
      </div>

      {/* A4 Sheet Container */}
      <div className="print-container max-w-4xl mx-auto bg-white p-8 sm:p-12 shadow-sm rounded-lg border border-slate-200">
        {/* Header: Company branding & Invoice meta */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                S
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                SubSentry
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Automated Subscription & Invoicing Platform
            </p>
            <p className="text-xs text-slate-600 mt-2">
              GSTIN: 29AAACS1234F1Z8
              <br />
              billing@subsentry.com • +91 80 1234 5678
            </p>
          </div>

          <div className="text-left sm:text-right">
            <h1 className="text-2xl font-bold uppercase tracking-wider text-slate-900">
              TAX INVOICE
            </h1>
            <p className="font-mono text-sm font-semibold text-indigo-600 mt-1">
              {invoice.invoice_number}
            </p>
            <div className="mt-3 text-xs text-slate-600 space-y-0.5">
              <p>
                <span className="text-slate-500">Date: </span>
                {formatDate(invoice.issue_date)}
              </p>
              <p>
                <span className="text-slate-500">Due Date: </span>
                {formatDate(invoice.due_date)}
              </p>
              <p>
                <span className="text-slate-500">Status: </span>
                <span className="font-semibold uppercase">{invoice.status}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Bill To Info */}
        <div className="py-6 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div>
            <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-1">
              Billed To:
            </h3>
            <p className="font-bold text-slate-900 text-sm">
              {customer?.company_name || `Customer #${invoice.customer_id}`}
            </p>
            {customer?.gstin && (
              <p className="text-slate-600 mt-0.5">
                GSTIN: <span className="font-mono">{customer.gstin}</span>
              </p>
            )}
            <p className="text-slate-600 mt-1 whitespace-pre-line">
              {customer?.billing_address || '—'}
            </p>
            {customer?.user && (
              <p className="text-slate-500 mt-1">
                Attn: {customer.user.full_name} ({customer.user.email})
              </p>
            )}
          </div>

          <div className="sm:text-right">
            <h3 className="font-semibold text-slate-900 uppercase tracking-wider mb-1">
              Billing Period:
            </h3>
            {invoice.period_start && invoice.period_end ? (
              <p className="text-slate-700">
                {formatDate(invoice.period_start)} to {formatDate(invoice.period_end)}
              </p>
            ) : (
              <p className="text-slate-500">Single period</p>
            )}
            {invoice.subscription_id && (
              <p className="text-slate-600 mt-1">
                Subscription Ref: #{invoice.subscription_id}
              </p>
            )}
          </div>
        </div>

        {/* Line Items Table */}
        <div className="py-6">
          <table className="print-table w-full text-xs">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="py-2.5 text-left font-semibold text-slate-700">#</th>
                <th className="py-2.5 text-left font-semibold text-slate-700">Description</th>
                <th className="py-2.5 text-right font-semibold text-slate-700">Qty</th>
                <th className="py-2.5 text-right font-semibold text-slate-700">Unit Price</th>
                <th className="py-2.5 text-right font-semibold text-slate-700">Discount</th>
                <th className="py-2.5 text-right font-semibold text-slate-700">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((l, index) => (
                <tr key={l.id || index}>
                  <td className="py-2.5 text-slate-400 font-mono">{index + 1}</td>
                  <td className="py-2.5 text-slate-900 font-medium">{l.description}</td>
                  <td className="py-2.5 text-right text-slate-700 font-mono">{l.quantity}</td>
                  <td className="py-2.5 text-right text-slate-700 font-mono">
                    {formatCurrency(l.unit_price)}
                  </td>
                  <td className="py-2.5 text-right text-slate-700 font-mono">
                    {formatCurrency(l.discount)}
                  </td>
                  <td className="py-2.5 text-right text-slate-900 font-semibold font-mono">
                    {formatCurrency(l.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tax Breakdown & Totals */}
        <div className="py-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-6 print-break-inside-avoid">
          {/* Tax Breakdown */}
          <div>
            {tax_breakdown && tax_breakdown.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">
                  Tax Breakdown
                </h4>
                <table className="w-full text-xs text-slate-600">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-1 text-left">Tax Rule</th>
                      <th className="py-1 text-right">Taxable</th>
                      <th className="py-1 text-right">Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tax_breakdown.map((t, idx) => (
                      <tr key={idx} className="border-b border-slate-100">
                        <td className="py-1 font-medium">{t.name} ({t.rate}%)</td>
                        <td className="py-1 text-right font-mono">{formatCurrency(t.taxable_amount)}</td>
                        <td className="py-1 text-right font-mono font-medium">{formatCurrency(t.tax)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Amount Calculation Summary */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-semibold text-slate-900 font-mono">
                {formatCurrency(invoice.subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Taxes:</span>
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
            <div className="pt-2 border-t-2 border-slate-900 flex justify-between text-sm font-bold text-slate-900">
              <span>Total Invoice Amount:</span>
              <span className="text-indigo-600 font-mono">
                {formatCurrency(invoice.total)}
              </span>
            </div>
            <div className="flex justify-between text-emerald-600 font-medium">
              <span>Total Paid:</span>
              <span className="font-mono">{formatCurrency(invoice.amount_paid)}</span>
            </div>
            <div className="flex justify-between text-amber-700 font-bold">
              <span>Outstanding Balance:</span>
              <span className="font-mono">{formatCurrency(invoice.outstanding)}</span>
            </div>
          </div>
        </div>

        {/* Payments history */}
        {payments && payments.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-200 print-break-inside-avoid">
            <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">
              Payment Receipts
            </h4>
            <table className="w-full text-xs text-slate-600">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-1">Date</th>
                  <th className="py-1">Method</th>
                  <th className="py-1">Reference</th>
                  <th className="py-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-1">{formatDate(p.payment_date || p.paid_at || p.created_at)}</td>
                    <td className="py-1 uppercase font-medium">{String(p.payment_method).replace('_', ' ')}</td>
                    <td className="py-1 font-mono">{p.transaction_id || p.payment_reference || '—'}</td>
                    <td className="py-1 text-right font-mono font-semibold text-emerald-600">
                      {formatCurrency(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer notes */}
        <div className="mt-8 pt-6 border-t border-slate-200 text-center text-[10px] text-slate-400">
          <p>Thank you for your business. Please remit payments within the specified due date.</p>
          <p className="mt-1">Generated by SubSentry Automated Billing System.</p>
        </div>
      </div>
    </div>
  );
}
