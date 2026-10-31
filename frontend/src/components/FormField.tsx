/**
 * src/components/FormField.tsx
 * Wrapper for react-hook-form field with label, input, and error message.
 */
import React from 'react';
import type { FieldError } from 'react-hook-form';
import { cn } from '../utils/cn';

interface FormFieldProps {
  id: string;
  label: string;
  error?: FieldError;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Wraps any input/select/textarea with a label and error message.
 * The caller is responsible for passing id and aria props directly to the
 * input element. This component handles the surrounding label/error structure.
 */
export function FormField({
  id,
  label,
  error,
  required = false,
  hint,
  className,
  children,
}: FormFieldProps) {
  const errorId = `${id}-error`;
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className={cn('flex flex-col gap-0', className)}>
      <label htmlFor={id} className="label">
        {label}
        {required && (
          <span className="text-red-400 ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="text-xs text-slate-500 mb-1.5">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={errorId} className="error-msg" role="alert">
          {error.message}
        </p>
      )}
    </div>
  );
}

// ─── Convenience text input field ───────────────────────────────────────────
interface TextFieldProps {
  id: string;
  label: string;
  error?: FieldError;
  required?: boolean;
  hint?: string;
  className?: string;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
}

export function TextField({
  id,
  label,
  error,
  required,
  hint,
  className,
  inputProps,
}: TextFieldProps) {
  return (
    <FormField
      id={id}
      label={label}
      error={error}
      required={required}
      hint={hint}
      className={className}
    >
      <input
        id={id}
        type="text"
        aria-invalid={error ? 'true' : undefined}
        aria-required={required ? 'true' : undefined}
        className={cn('input', error && 'input-error', inputProps?.className)}
        {...inputProps}
      />
    </FormField>
  );
}
