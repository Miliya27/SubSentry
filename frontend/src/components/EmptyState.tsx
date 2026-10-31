/**
 * src/components/EmptyState.tsx
 * Generic empty / zero-results state with optional action button.
 */
import { type LucideIcon, Inbox } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../utils/cn';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-16 px-6 text-center',
        className
      )}
    >
      <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-slate-800 text-slate-500">
        <Icon className="h-8 w-8" />
      </div>
      <div>
        <p className="text-base font-semibold text-slate-300">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-slate-500 max-w-xs">{description}</p>
        )}
      </div>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

/** Error state — shown when an API call fails */
interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ message, onRetry, className }: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-16 px-6 text-center',
        className
      )}
    >
      <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-red-900/30 text-red-400">
        <span className="text-3xl" aria-hidden="true">!</span>
      </div>
      <div>
        <p className="text-base font-semibold text-slate-300">Something went wrong</p>
        <p className="mt-1 text-sm text-slate-500 max-w-xs">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
