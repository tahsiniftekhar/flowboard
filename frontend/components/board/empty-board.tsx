'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';

const SUGGESTED = ['To do', 'In progress', 'Done'];

interface EmptyBoardProps {
  busy: boolean;
  onAddSuggested: (names: string[]) => Promise<boolean>;
  onAddColumn: (name: string) => Promise<boolean>;
}

export function EmptyBoard({ busy, onAddSuggested, onAddColumn }: EmptyBoardProps) {
  const [name, setName] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (name.trim() && (await onAddColumn(name.trim()))) setName('');
  }

  return (
    <div className="empty-board">
      <div className="empty-illustration" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <h2>This board has no columns yet</h2>
      <p>Columns are the stages of your workflow. Start with a classic setup or create your own.</p>
      <Button busy={busy} onClick={() => void onAddSuggested(SUGGESTED)}>
        Add {SUGGESTED.join(' / ')}
      </Button>
      <form className="empty-board-form" onSubmit={handleSubmit}>
        <input
          aria-label="Custom column name"
          placeholder="Or name your own column"
          value={name}
          maxLength={100}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" className="secondary-button" disabled={busy || !name.trim()}>
          Add
        </button>
      </form>
    </div>
  );
}
