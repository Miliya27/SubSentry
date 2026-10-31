/**
 * src/utils/format.ts
 * Formatting utilities – currency (INR) and date helpers.
 */

/**
 * Format a number as Indian Rupees using the en-IN locale.
 * e.g. 125000 → "₹1,25,000.00"
 */
export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format an ISO date string to a readable date.
 * e.g. "2024-03-15T00:00:00Z" → "15 Mar 2024"
 */
export function formatDate(
  dateString: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }
): string {
  if (!dateString) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', options).format(
      new Date(dateString)
    );
  } catch {
    return dateString;
  }
}

/**
 * Format an ISO date string to a short date-time.
 * e.g. "2024-03-15T10:30:00Z" → "15 Mar 2024, 10:30 AM"
 */
export function formatDateTime(dateString: string | null | undefined): string {
  return formatDate(dateString, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Return a relative time label like "3 days ago" or "in 2 hours".
 * Falls back to formatDate for dates older than a week.
 */
export function formatRelativeDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    const diff = Date.now() - new Date(dateString).getTime();
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const seconds = Math.round(diff / 1000);
    if (Math.abs(seconds) < 60) return rtf.format(-seconds, 'second');
    const minutes = Math.round(seconds / 60);
    if (Math.abs(minutes) < 60) return rtf.format(-minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return rtf.format(-hours, 'hour');
    const days = Math.round(hours / 24);
    if (Math.abs(days) < 7) return rtf.format(-days, 'day');
    return formatDate(dateString);
  } catch {
    return dateString;
  }
}
