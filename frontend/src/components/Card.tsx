/**
 * src/components/Card.tsx
 * Flexible card container with optional header, footer, and hover variant.
 */
import React from 'react';
import { cn } from '../utils/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

interface CardSectionProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className, hover = false }: CardProps) {
  return (
    <div className={cn(hover ? 'card-hover' : 'card', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: CardSectionProps) {
  return (
    <div className={cn('card-header flex items-center justify-between', className)}>
      {children}
    </div>
  );
}

export function CardBody({ children, className }: CardSectionProps) {
  return <div className={cn('card-body', className)}>{children}</div>;
}

export function CardFooter({ children, className }: CardSectionProps) {
  return <div className={cn('card-footer', className)}>{children}</div>;
}

// ─── Stat Card ─────────────────────────────────────────────────────────────
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { value: number; label?: string };
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className,
}: StatCardProps) {
  const isPositive = (trend?.value ?? 0) >= 0;

  return (
    <Card className={cn('card-hover', className)}>
      <CardBody>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider truncate">
              {title}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-100 truncate">
              {value}
            </p>
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-500 truncate">{subtitle}</p>
            )}
            {trend && (
              <p
                className={cn(
                  'mt-2 text-xs font-medium',
                  isPositive ? 'text-green-400' : 'text-red-400'
                )}
              >
                {isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
                {trend.label && (
                  <span className="text-slate-500 font-normal"> {trend.label}</span>
                )}
              </p>
            )}
          </div>
          {icon && (
            <div className="flex-shrink-0 p-2.5 rounded-lg bg-primary-600/10 text-primary-400">
              {icon}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
