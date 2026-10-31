/**
 * src/components/StatusBadge.tsx
 * Status badge that maps ONLY real API contract status enums to color classes:
 * - Subscription: draft, quotation, confirmed, active, paused, closed
 * - Invoice: draft, confirmed, paid, cancelled (+ derived overdue, partially_paid)
 */
import { cn } from '../utils/cn';
import type { SubscriptionStatus, InvoiceStatus } from '../types';

export type AllowedStatus = SubscriptionStatus | InvoiceStatus;

const STATUS_LABEL: Record<string, string> = {
  // Common / Invoice / Subscription
  draft: 'Draft',
  quotation: 'Quotation',
  confirmed: 'Confirmed',
  active: 'Active',
  paused: 'Paused',
  closed: 'Closed',
  paid: 'Paid',
  cancelled: 'Cancelled',
  // Derived invoice states
  overdue: 'Overdue',
  partially_paid: 'Partially Paid',
};

/** Dot indicator colours – maps status → bg colour class in light theme */
const DOT_COLOR: Record<string, string> = {
  active: 'bg-emerald-500',
  paid: 'bg-emerald-500',
  confirmed: 'bg-cyan-500',
  quotation: 'bg-blue-500',
  paused: 'bg-amber-500',
  partially_paid: 'bg-amber-500',
  draft: 'bg-slate-400',
  closed: 'bg-slate-400',
  cancelled: 'bg-rose-500',
  overdue: 'bg-rose-500',
};

interface StatusBadgeProps {
  status: AllowedStatus | string;
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
  const dotColor = DOT_COLOR[status] ?? 'bg-slate-400';

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
