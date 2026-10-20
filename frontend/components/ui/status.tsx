'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Notice } from '@/types';
import { IconAlert, IconCheck, IconClose } from './icons';

export type ToastNotice = Notice & { id: number };

let nextToastId = 0;

export function useToast() {
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const notify = useCallback((notice: Notice) => setToast({ ...notice, id: ++nextToastId }), []);
  const dismiss = useCallback(() => setToast(null), []);
  return { toast, notify, dismiss };
}

interface ToastProps {
  toast: ToastNotice | null;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(onDismiss, toast.error ? 6500 : 3500);
    return () => window.clearTimeout(timeout);
  }, [toast, onDismiss]);

  return (
    <div className="toast-region" aria-live="polite">
      {toast && (
        <div
          key={toast.id}
          className={`toast ${toast.error ? 'toast-error' : 'toast-success'}`}
          role={toast.error ? 'alert' : 'status'}
        >
          <span className="toast-icon">{toast.error ? <IconAlert /> : <IconCheck />}</span>
          <span className="toast-text">{toast.text}</span>
          <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={onDismiss}>
            <IconClose />
          </button>
        </div>
      )}
    </div>
  );
}
