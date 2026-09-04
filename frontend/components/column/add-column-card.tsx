'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { IconPlus } from '@/components/ui/icons';

interface AddColumnCardProps {
  busy: boolean;
  onAddColumn: (name: string) => Promise<boolean>;
}

export function AddColumnCard({ busy, onAddColumn }: AddColumnCardProps) {
  const [name, setName] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const success = await onAddColumn(name.trim());
    if (success) {
      setName('');
    }
  }

  return (
    <form className="add-column-card" onSubmit={handleSubmit}>
      <strong>Build your workflow</strong>
      <span>Add another column when your process grows.</span>
      <input
        aria-label="New column name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Column name"
      />
      <Button busy={busy}>
        <IconPlus /> Add column
      </Button>
    </form>
  );
}
