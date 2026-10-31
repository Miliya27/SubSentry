/**
 * src/components/LifecycleStepper.tsx
 * Visual state machine stepper for Subscriptions:
 * Draft -> Quotation -> Confirmed -> Active -> Closed (with Paused as side state).
 */
import { Check, PauseCircle, XCircle } from 'lucide-react';
import type { SubscriptionStatus } from '../types';

interface LifecycleStepperProps {
  status: SubscriptionStatus;
  className?: string;
}

const MAIN_STEPS: { key: SubscriptionStatus; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'quotation', label: 'Quotation' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'active', label: 'Active' },
  { key: 'closed', label: 'Closed' },
];

export function LifecycleStepper({ status, className = '' }: LifecycleStepperProps) {
  const isPaused = status === 'paused';
  const isClosed = status === 'closed';

  // Find index in primary track
  const stepIndex = isPaused
    ? 3 // paused branches off active (index 3)
    : MAIN_STEPS.findIndex((s) => s.key === status);

  return (
    <div className={`p-4 bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
      {/* Header with current status pill */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Lifecycle Progression
        </span>
        {isPaused ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 ring-1 ring-amber-300">
            <PauseCircle className="h-3.5 w-3.5" /> Paused (Active branch)
          </span>
        ) : isClosed ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 ring-1 ring-slate-300">
            <XCircle className="h-3.5 w-3.5" /> Closed / Terminated
          </span>
        ) : null}
      </div>

      {/* Stepper track */}
      <div className="flex items-center justify-between relative">
        {MAIN_STEPS.map((step, idx) => {
          const isCurrent = step.key === status;
          const isCompleted = stepIndex > idx || (isClosed && idx === MAIN_STEPS.length - 1);
          const isBranchingPaused = isPaused && step.key === 'active';

          return (
            <div
              key={step.key}
              className="flex-1 flex flex-col items-center relative text-center group"
            >
              {/* Connecting line */}
              {idx > 0 && (
                <div
                  className={`absolute top-4 -left-1/2 w-full h-0.5 -z-0 transition-colors ${
                    stepIndex >= idx ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                />
              )}

              {/* Circle / Icon */}
              <div
                className={`relative z-10 h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isBranchingPaused
                    ? 'bg-amber-500 text-white ring-4 ring-amber-100'
                    : isCurrent
                    ? 'bg-primary-600 text-white ring-4 ring-primary-100 shadow-md'
                    : isCompleted
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-400 border border-slate-300'
                }`}
              >
                {isCompleted && !isCurrent ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>

              {/* Label */}
              <span
                className={`mt-2 text-xs transition-colors ${
                  isCurrent || isBranchingPaused
                    ? 'font-bold text-slate-900'
                    : isCompleted
                    ? 'font-medium text-slate-700'
                    : 'text-slate-400'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LifecycleStepper;
