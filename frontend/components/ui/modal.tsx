'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconClose } from './icons';

// Open modals, newest last, so Escape only closes the topmost one.
const openModals: symbol[] = [];

const FOCUSABLE = 'input:not([type="hidden"]), textarea, select, [data-autofocus]';

interface ModalProps {
  title: string;
  description?: string;
  close: () => void;
  children: ReactNode;
  size?: 'md' | 'lg';
}

export function Modal({ title, description, close, children, size = 'md' }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);

  useEffect(() => {
    closeRef.current = close;
  }, [close]);

  useEffect(() => {
    const id = Symbol('modal');
    openModals.push(id);
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const dialog = dialogRef.current;
    if (dialog && !dialog.contains(document.activeElement)) {
      const target =
        dialog.querySelector<HTMLElement>(FOCUSABLE) ??
        dialog.querySelector<HTMLElement>('.confirm-actions button, .modal-actions button');
      target?.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && openModals[openModals.length - 1] === id) {
        event.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      openModals.splice(openModals.indexOf(id), 1);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, []);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        className={`modal ${size === 'lg' ? 'modal-lg' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-heading">
          <div>
            <h3 id={titleId}>{title}</h3>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="icon-button" aria-label="Close dialog" onClick={close}>
            <IconClose />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  title: string;
  description: string;
  busy: boolean;
  confirmLabel?: string;
  busyLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  description,
  busy,
  confirmLabel = 'Delete',
  busyLabel = 'Deleting...',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal title={title} description={description} close={onCancel}>
      <div className="confirm-actions">
        <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="button danger" onClick={onConfirm} disabled={busy}>
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
