/**
 * src/components/RecordPaymentModal.tsx
 * Modal for recording payments against an invoice (§8.12).
 * Validates amount > 0 and <= outstanding, but always surfaces server errors.
 */
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CreditCard, AlertCircle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { FormField } from './FormField';
import { paymentsService } from '../services/payments';
import { getErrorMessage, getFieldErrors } from '../services/api';
import { formatCurrency, toMoneyString } from '../utils/format';
import type { PaymentMethod } from '../types';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: number;
  invoiceNumber: string;
  outstanding: string;
  onSuccess: () => void;
}

const paymentSchema = z.object({
  method: z.enum(['cash', 'bank_transfer', 'card', 'upi', 'cheque']),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: 'Amount must be greater than 0',
    }),
  payment_date: z.string().min(1, 'Payment date is required'),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

export function RecordPaymentModal({
  isOpen,
  onClose,
  invoiceId,
  invoiceNumber,
  outstanding,
  onSuccess,
}: RecordPaymentModalProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
    reset,
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      method: 'bank_transfer',
      amount: outstanding,
      payment_date: new Date().toISOString().split('T')[0],
      reference: '',
      notes: '',
    },
  });

  // Whenever modal opens, prefill amount with invoice's outstanding
  useEffect(() => {
    if (isOpen) {
      setServerError(null);
      reset({
        method: 'bank_transfer',
        amount: toMoneyString(outstanding),
        payment_date: new Date().toISOString().split('T')[0],
        reference: '',
        notes: '',
      });
    }
  }, [isOpen, outstanding, reset]);

  const onSubmit = async (data: PaymentFormData) => {
    setServerError(null);

    // Client-side guard check: amount <= outstanding
    const numAmount = parseFloat(data.amount);
    const numOutstanding = parseFloat(outstanding);
    if (numAmount > numOutstanding) {
      setError('amount', {
        message: `Amount cannot exceed outstanding balance (${formatCurrency(outstanding)})`,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await paymentsService.recordPayment(invoiceId, {
        method: data.method as PaymentMethod,
        amount: toMoneyString(data.amount),
        payment_date: data.payment_date,
        reference: data.reference?.trim() || undefined,
        notes: data.notes?.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setServerError(getErrorMessage(err));
      const fieldErrors = getFieldErrors(err);
      Object.entries(fieldErrors).forEach(([field, msg]) => {
        if (field in data) {
          setError(field as keyof PaymentFormData, { message: msg });
        }
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Record Payment for ${invoiceNumber}`}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {serverError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
          <span className="text-xs text-slate-600 font-medium">Outstanding Balance:</span>
          <span className="text-sm font-bold text-slate-900">
            {formatCurrency(outstanding)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField id="payment-method-select" label="Payment Method" error={errors.method} required>
            <select
              id="payment-method-select"
              className="input text-xs"
              {...register('method')}
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
            </select>
          </FormField>

          <FormField id="payment-amount-input" label="Amount (INR)" error={errors.amount} required>
            <div className="relative">
              <input
                id="payment-amount-input"
                type="number"
                step="0.01"
                min="0.01"
                className="input text-xs pr-16"
                {...register('amount')}
              />
              <button
                type="button"
                onClick={() => setValue('amount', toMoneyString(outstanding))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] bg-slate-200 text-slate-700 hover:bg-slate-300 font-semibold px-1.5 py-0.5 rounded"
              >
                Pay Full
              </button>
            </div>
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField id="payment-date-input" label="Payment Date" error={errors.payment_date} required>
            <input
              id="payment-date-input"
              type="date"
              className="input text-xs"
              {...register('payment_date')}
            />
          </FormField>

          <FormField id="payment-reference-input" label="Reference / Transaction ID" error={errors.reference}>
            <input
              id="payment-reference-input"
              type="text"
              placeholder="e.g. UTR12345678"
              className="input text-xs"
              {...register('reference')}
            />
          </FormField>
        </div>

        <FormField id="payment-notes-input" label="Notes" error={errors.notes}>
          <textarea
            id="payment-notes-input"
            rows={2}
            placeholder="Optional payment notes..."
            className="input text-xs"
            {...register('notes')}
          />
        </FormField>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isSubmitting}
            leftIcon={<CreditCard className="h-4 w-4" />}
            id="submit-payment-button"
          >
            Record Payment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
