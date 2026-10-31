/**
 * src/components/ConfirmDialog.tsx
 * Reusable confirmation dialog for destructive or state-changing actions.
 */

import { AlertTriangle, Info } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Spinner } from './Spinner';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}: ConfirmDialogProps) {
  const isDanger = variant === 'danger';

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" preventClose={isLoading}>
      <div className="flex flex-col items-center text-center p-2">
        <div
          className={`h-12 w-12 rounded-full flex items-center justify-center mb-4 ${
            isDanger ? 'bg-rose-50 text-rose-600' : 'bg-primary-50 text-primary-600'
          }`}
        >
          {isDanger ? (
            <AlertTriangle className="h-6 w-6" />
          ) : (
            <Info className="h-6 w-6" />
          )}
        </div>

        <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-xs text-slate-500 mb-6">{message}</p>

        <div className="flex items-center gap-3 w-full">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={isLoading}
            id="confirm-cancel-button"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={isDanger ? 'danger' : 'primary'}
            className="flex-1"
            onClick={onConfirm}
            disabled={isLoading}
            id="confirm-action-button"
          >
            {isLoading ? (
              <>
                <Spinner size="sm" className="mr-1.5" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
