/**
 * src/pages/SubscriptionDetailPage.tsx
 * Subscription Detail view featuring LifecycleStepper, legal transition buttons
 * conforming strictly to state machine guards, line items breakdown, and server totals.
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  CheckCircle,
  Play,
  Pause,
  RotateCw,
  XCircle,
  Building2,
  Calendar,
  Layers,
  AlertCircle,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { subscriptionsService } from '../services/subscriptions';
import { getErrorMessage } from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Card, CardHeader, CardBody } from '../components/Card';
import { LifecycleStepper } from '../components/LifecycleStepper';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Spinner } from '../components/Spinner';
import type { Subscription } from '../types';

export default function SubscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canPerformActions = user?.role === 'admin' || user?.role === 'staff';

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Close confirmation modal
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);

  const loadSubscription = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await subscriptionsService.getSubscription(id);
      setSubscription(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  // Transition handler
  async function handleTransition(
    actionFn: () => Promise<unknown>
  ) {
    setIsProcessing(true);
    setActionError(null);
    try {
      await actionFn();
      await loadSubscription();
    } catch (err: unknown) {
      setActionError(getErrorMessage(err));
    } finally {
      setIsProcessing(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="alert-error max-w-lg mx-auto" role="alert">
          <AlertCircle className="h-4 w-4" />
          <p>{error || 'Subscription not found.'}</p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/subscriptions')}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Subscriptions
        </Button>
      </div>
    );
  }

  const { status, plan } = subscription;

  // Plan guards from API contract
  const allowPause = plan?.allow_pause ?? true;
  const allowRenewal = plan?.allow_renewal ?? true;
  const allowEarlyClose = plan?.allow_early_close ?? true;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <PageHeader
        title={`Subscription: ${subscription.subscription_number || `#${subscription.id}`}`}
        subtitle={`Created on ${formatDate(subscription.created_at)}`}
        actions={
          <Button
            variant="secondary"
            onClick={() => navigate('/subscriptions')}
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Subscriptions
          </Button>
        }
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Subscriptions', href: '/subscriptions' },
          { label: subscription.subscription_number || String(subscription.id) },
        ]}
      />

      {/* Business-rule error toast / banner */}
      {actionError && (
        <div
          className="alert-error animate-scale-in"
          role="alert"
          id="subscription-action-error"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <span className="font-bold">Action could not be executed: </span>
            {actionError}
          </div>
        </div>
      )}

      {/* Visual State Machine Stepper */}
      <LifecycleStepper status={subscription.status} />

      {/* Action Controls Bar (shown only for legal transitions) */}
      {canPerformActions && (
        <Card className="border-indigo-100 bg-gradient-to-r from-white via-indigo-50/20 to-white">
          <CardBody className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              <span className="font-semibold text-slate-800">Available Lifecycle Actions:</span>{' '}
              {status === 'closed'
                ? 'This subscription is in the terminal Closed state.'
                : 'Execute valid state machine transitions according to plan rules.'}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Draft -> Send Quotation */}
              {status === 'draft' && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isProcessing}
                  onClick={() =>
                    handleTransition(() =>
                      subscriptionsService.sendQuotation(subscription.id)
                    )
                  }
                  id="action-send-quotation"
                >
                  <Send className="h-3.5 w-3.5 mr-1" /> Send Quotation
                </Button>
              )}

              {/* Quotation -> Confirm */}
              {status === 'quotation' && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isProcessing}
                  onClick={() =>
                    handleTransition(() =>
                      subscriptionsService.confirmSubscription(subscription.id)
                    )
                  }
                  id="action-confirm-subscription"
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1" /> Confirm Subscription
                </Button>
              )}

              {/* Confirmed -> Activate */}
              {status === 'confirmed' && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isProcessing}
                  onClick={() =>
                    handleTransition(() =>
                      subscriptionsService.activateSubscription(subscription.id)
                    )
                  }
                  id="action-activate-subscription"
                >
                  <Play className="h-3.5 w-3.5 mr-1" /> Activate Subscription
                </Button>
              )}

              {/* Active -> Pause */}
              {status === 'active' && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isProcessing || !allowPause}
                  title={
                    !allowPause
                      ? 'Plan terms do not allow pausing'
                      : 'Temporarily pause subscription'
                  }
                  onClick={() =>
                    handleTransition(() =>
                      subscriptionsService.pauseSubscription(subscription.id)
                    )
                  }
                  id="action-pause-subscription"
                >
                  <Pause className="h-3.5 w-3.5 mr-1" /> Pause
                </Button>
              )}

              {/* Paused -> Resume */}
              {status === 'paused' && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isProcessing}
                  onClick={() =>
                    handleTransition(() =>
                      subscriptionsService.resumeSubscription(subscription.id)
                    )
                  }
                  id="action-resume-subscription"
                >
                  <Play className="h-3.5 w-3.5 mr-1" /> Resume
                </Button>
              )}

              {/* Active -> Renew */}
              {status === 'active' && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isProcessing || !allowRenewal}
                  title={
                    !allowRenewal
                      ? 'Plan terms do not allow renewal'
                      : 'Extend expiration by one cycle'
                  }
                  onClick={() =>
                    handleTransition(() =>
                      subscriptionsService.renewSubscription(subscription.id)
                    )
                  }
                  id="action-renew-subscription"
                >
                  <RotateCw className="h-3.5 w-3.5 mr-1" /> Renew Cycle
                </Button>
              )}

              {/* Active or Paused -> Close */}
              {(status === 'active' || status === 'paused') && (
                <Button
                  variant="danger"
                  size="sm"
                  disabled={isProcessing || !allowEarlyClose}
                  title={
                    !allowEarlyClose
                      ? 'Early closure is restricted by plan policy'
                      : 'Terminate subscription'
                  }
                  onClick={() => setIsCloseModalOpen(true)}
                  id="action-close-subscription"
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Close Subscription
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Customer</h3>
            </div>
          </CardHeader>
          <CardBody className="space-y-2 text-xs">
            <div>
              <span className="text-slate-400 block">Company:</span>
              <span className="font-bold text-slate-800">
                {subscription.customer?.company_name || `Customer #${subscription.customer_id}`}
              </span>
            </div>
            {subscription.customer?.user && (
              <div>
                <span className="text-slate-400 block">Contact:</span>
                <span className="text-slate-700">
                  {subscription.customer.user.full_name} ({subscription.customer.user.email})
                </span>
              </div>
            )}
            {subscription.customer?.billing_address && (
              <div>
                <span className="text-slate-400 block">Billing Address:</span>
                <span className="text-slate-600">
                  {subscription.customer.billing_address}
                </span>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Plan Terms */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Plan & Terms</h3>
            </div>
          </CardHeader>
          <CardBody className="space-y-2 text-xs">
            <div>
              <span className="text-slate-400 block">Plan:</span>
              <span className="font-bold text-slate-800">
                {subscription.plan?.name || `Plan #${subscription.plan_id}`}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Billing Frequency:</span>
              <span className="capitalize font-semibold text-slate-700">
                {subscription.plan?.billing_frequency || '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Payment Terms:</span>
              <span className="text-slate-700">
                Net {subscription.payment_terms_days} days
              </span>
            </div>
          </CardBody>
        </Card>

        {/* Schedule & Billing */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Dates</h3>
            </div>
          </CardHeader>
          <CardBody className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Start Date:</span>
              <span className="font-semibold text-slate-800">
                {formatDate(subscription.start_date)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Expiry Date:</span>
              <span className="font-semibold text-slate-800">
                {subscription.expiry_date ? formatDate(subscription.expiry_date) : 'Indefinite'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Next Billing:</span>
              <span className="font-bold text-indigo-600">
                {subscription.next_billing_date ? formatDate(subscription.next_billing_date) : '—'}
              </span>
            </div>
            {subscription.cancelled_at && (
              <div className="flex justify-between pt-1 border-t border-slate-100 text-rose-600">
                <span>Closed At:</span>
                <span>{formatDate(subscription.cancelled_at)}</span>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Subscription Line Items Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">
              Subscription Lines & Pricing Snapshot
            </h3>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div className="table-wrapper border-0 rounded-none">
            <table className="table">
              <thead>
                <tr>
                  <th>Item / Variant</th>
                  <th>Quantity</th>
                  <th>Unit Price (INR)</th>
                  <th>Discount</th>
                  <th>Tax Rule</th>
                  <th className="text-right">Line Total (INR)</th>
                </tr>
              </thead>
              <tbody>
                {subscription.lines && subscription.lines.length > 0 ? (
                  subscription.lines.map((line, idx) => (
                    <tr key={line.id || idx}>
                      <td className="font-medium text-slate-900">
                        Variant #{line.product_variant_id}
                      </td>
                      <td>{line.quantity}</td>
                      <td>{formatCurrency(line.unit_price)}</td>
                      <td>{formatCurrency(line.discount || '0.00')}</td>
                      <td>
                        {line.tax_rule_id ? `Tax Rule #${line.tax_rule_id}` : 'None'}
                      </td>
                      <td className="text-right font-bold text-slate-900">
                        {formatCurrency(line.line_total)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-400 text-xs">
                      No line items recorded for this subscription.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totals Summary (strictly displaying API returned totals) */}
          <div className="p-6 bg-slate-50/50 border-t border-slate-200 flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Billing Frequency:</span>
                <span className="capitalize font-semibold text-slate-800">
                  {subscription.plan?.billing_frequency || 'monthly'}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-base font-extrabold text-slate-900">
                <span>Total Cycle Amount:</span>
                <span className="text-primary-600 text-lg">
                  {formatCurrency(subscription.total)}
                </span>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Close Subscription Confirmation Modal */}
      <ConfirmDialog
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        onConfirm={async () => {
          setIsCloseModalOpen(false);
          await handleTransition(() =>
            subscriptionsService.closeSubscription(subscription.id)
          );
        }}
        title="Close Subscription"
        message="Are you sure you want to terminate this subscription? It will enter the closed state and halt recurring billing."
        confirmText="Confirm Close"
        variant="danger"
        isLoading={isProcessing}
      />
    </div>
  );
}
