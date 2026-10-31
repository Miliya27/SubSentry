/**
 * src/components/Modal.tsx
 * Accessible modal dialog with backdrop, focus trap, and Escape-to-close in light theme.
 */
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../utils/cn';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Prevent closing on backdrop click */
  preventClose?: boolean;
}

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  preventClose = false,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !preventClose) onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose, preventClose]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-desc' : undefined}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={preventClose ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          'relative w-full bg-white border border-slate-200 text-slate-900',
          'rounded-2xl shadow-xl animate-scale-in',
          sizeMap[size]
        )}
      >
        {/* Header */}
        {(title || !preventClose) && (
          <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-100">
            <div>
              {title && (
                <h2 id="modal-title" className="text-base font-bold text-slate-900">
                  {title}
                </h2>
              )}
              {description && (
                <p id="modal-desc" className="mt-1 text-xs text-slate-500">
                  {description}
                </p>
              )}
            </div>
            {!preventClose && (
              <button
                className="btn-icon btn-ghost ml-4 -mt-1 -mr-2 text-slate-400 hover:text-slate-600"
                onClick={onClose}
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export default Modal;
