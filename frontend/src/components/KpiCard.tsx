/**
 * src/components/KpiCard.tsx
 * Reusable KPI card with loading skeleton and distinct status accents.
 */
import React from 'react';
import { Card, CardBody } from './Card';
import { cn } from '../utils/cn';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  badge?: string;
  badgeColor?: 'emerald' | 'amber' | 'red' | 'indigo' | 'slate';
  icon?: React.ReactNode;
  isLoading?: boolean;
  className?: string;
}

const badgeColorMap = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
};

export function KpiCard({
  title,
  value,
  subtitle,
  badge,
  badgeColor = 'slate',
  icon,
  isLoading = false,
  className,
}: KpiCardProps) {
  return (
    <Card className={cn('hover:border-slate-300 transition-colors', className)}>
      <CardBody className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            {title}
          </span>
          {icon && <div className="p-2 rounded-lg bg-slate-50 text-slate-600">{icon}</div>}
        </div>

        {isLoading ? (
          <div className="mt-3 space-y-2 animate-pulse">
            <div className="h-7 w-28 bg-slate-200 rounded" />
            <div className="h-3 w-40 bg-slate-100 rounded" />
          </div>
        ) : (
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
                {value}
              </span>
              {badge && (
                <span
                  className={cn(
                    'text-[10px] font-semibold px-1.5 py-0.5 rounded border',
                    badgeColorMap[badgeColor]
                  )}
                >
                  {badge}
                </span>
              )}
            </div>
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
