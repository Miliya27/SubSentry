/**
 * src/components/PageHeader.tsx
 * Top section of a page: title, breadcrumbs, and action buttons.
 */
import React from 'react';
import { cn } from '../utils/cn';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-1 mb-6', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1 text-xs text-slate-500">
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <li aria-hidden="true">/</li>}
                <li>
                  {crumb.href ? (
                    <a
                      href={crumb.href}
                      className="hover:text-slate-300 transition-colors"
                    >
                      {crumb.label}
                    </a>
                  ) : (
                    <span
                      className={
                        i === breadcrumbs.length - 1 ? 'text-slate-300' : ''
                      }
                    >
                      {crumb.label}
                    </span>
                  )}
                </li>
              </React.Fragment>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-100 leading-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-sm text-slate-500 truncate">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex-shrink-0 flex items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
