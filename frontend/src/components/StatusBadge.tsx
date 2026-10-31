/**
 * src/components/StatusBadge.tsx
 * Status badge that maps every API contract status enum to its colour class.
 */
import { cn } from '../utils/cn';
import type {
  SubscriptionStatus,
  InvoiceStatus,
  PaymentStatus,
  QuotationStatus,
} from '../types';

type AnyStatus =
  | SubscriptionStatus
  | InvoiceStatus
  | PaymentStatus
  | QuotationStatus
  | string;

const STATUS_LABEL: Record<string, string> = {
  // Subscription
  active: 'Active',
  paused: 'Paused',
  cancelled: 'Cancelled',
  expired: 'Expired',
  pending: 'Pending',
  trialing: 'Trialing',
  // Invoice
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
  voided: 'Voided',
  partially_paid: 'Partial',
  // Payment
  completed: 'Completed',
  failed: 'Failed',
  refunded: 'Refunded',
  partially_refunded: 'Part. Refunded',
  // Quotation
  accepted: 'Accepted',
  rejected: 'Rejected',
};

/** Dot indicator colours – maps status → bg colour class */
const DOT_COLOR: Record<string, string> = {
  active: 'bg-green-400',
  accepted: 'bg-green-400',
  completed: 'bg-green-400',
  paid: 'bg-green-400',
  paused: 'bg-amber-400',
  partially_paid: 'bg-amber-400',
  partially_refunded: 'bg-amber-400',
  sent: 'bg-blue-400',
  pending: 'bg-blue-400',
  trialing: 'bg-violet-400',
  refunded: 'bg-violet-400',
  cancelled: 'bg-red-400',
  failed: 'bg-red-400',
  overdue: 'bg-red-400',
  rejected: 'bg-red-400',
  draft: 'bg-slate-500',
  voided: 'bg-slate-600',
  expired: 'bg-slate-500',
};

interface StatusBadgeProps {
  status: AnyStatus;
  showDot?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  showDot = true,
  className,
}: StatusBadgeProps) {
  const badgeClass = `badge-${status}`;
  const label = STATUS_LABEL[status] ?? status;
  const dotColor = DOT_COLOR[status] ?? 'bg-slate-500';

  return (
    <span className={cn(badgeClass, className)}>
      {showDot && (
        <span
          className={cn('inline-block h-1.5 w-1.5 rounded-full', dotColor)}
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  );
}
