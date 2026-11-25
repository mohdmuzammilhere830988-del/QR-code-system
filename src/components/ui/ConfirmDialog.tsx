import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={loading ? undefined : onCancel}
            className="fixed inset-0 bg-black/45 backdrop-blur-xs"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-md rounded-2xl border border-[#E6E4DF] bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    destructive ? 'bg-red-50 text-[#B91C1C]' : 'bg-amber-50 text-[#B45309]'
                  }`}
                >
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h2 id="confirm-dialog-title" className="text-base font-semibold text-zinc-900">
                    {title}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-600">{description}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                aria-label="Close dialog"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {children && <div className="mt-4">{children}</div>}

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="h-10 rounded-xl border border-[#E6E4DF] bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className={`h-10 rounded-xl px-4 text-sm font-medium text-white transition-colors disabled:opacity-60 ${
                  destructive
                    ? 'bg-[#B91C1C] hover:bg-[#991B1B]'
                    : 'bg-[#1B4332] hover:bg-[#143326]'
                }`}
              >
                {loading ? 'Processing...' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
