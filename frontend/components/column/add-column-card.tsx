'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { IconPlus } from '@/components/ui/icons';

interface AddColumnCardProps {
  busy: boolean;
  onAddColumn: (name: string) => Promise<boolean>;
}

export function AddColumnCard({ busy, onAddColumn }: AddColumnCardProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    if (await onAddColumn(name.trim())) {
      setName('');
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="add-column-card add-column-collapsed" onClick={() => setOpen(true)}>
        <IconPlus /> Add column
      </button>
    );
  }

  return (
    <form className="add-column-card" onSubmit={handleSubmit}>
      <input
        autoFocus
        aria-label="New column name"
        value={name}
        maxLength={100}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
        placeholder="Column name"
      />
      <div className="quick-task-actions">
        <Button busy={busy} disabled={!name.trim()}>
          Add column
        </Button>
        <button type="button" className="text-button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
