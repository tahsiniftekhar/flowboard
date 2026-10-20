'use client';

import { useRef, useState, type FormEvent } from 'react';

interface QuickAddTaskProps {
  busy: boolean;
  onSubmit: (title: string) => Promise<boolean>;
  onMoreOptions: (title: string) => void;
  onClose: () => void;
}

// Title-only entry that stays open after each success for rapid entry.
export function QuickAddTask({ busy, onSubmit, onMoreOptions, onClose }: QuickAddTaskProps) {
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const value = title.trim();
    if (!value || busy) return;
    if (await onSubmit(value)) {
      setTitle('');
      inputRef.current?.focus();
    }
  }

  return (
    <form className="quick-task" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        autoFocus
        value={title}
        maxLength={200}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
          }
        }}
        placeholder="Task title, then Enter"
        aria-label="New task title"
      />
      <div className="quick-task-actions">
        <button type="submit" className="button" disabled={busy || !title.trim()}>
          {busy ? 'Adding...' : 'Add'}
        </button>
        <button type="button" className="text-button" onClick={() => onMoreOptions(title.trim())}>
          More options
        </button>
        <button type="button" className="text-button quick-task-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
