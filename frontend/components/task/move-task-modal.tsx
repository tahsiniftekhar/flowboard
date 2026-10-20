'use client';

import { useState, type FormEvent } from 'react';
import type { Column, Task } from '@/types';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

interface MoveTaskModalProps {
  task: Task;
  columns: Column[];
  token: string;
  onClose: () => void;
  onMoved: () => void;
}

function positionLabel(index: number, count: number) {
  if (index === 0) return 'Top';
  if (index === count - 1) return 'Bottom';
  return `Position ${index + 1}`;
}

export function MoveTaskModal({ task, columns, token, onClose, onMoved }: MoveTaskModalProps) {
  const [columnId, setColumnId] = useState(task.columnId);
  const [index, setIndex] = useState(() => {
    const source = columns.find((column) => column.id === task.columnId);
    return Math.max(0, source?.tasks.findIndex((item) => item.id === task.id) ?? 0);
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const destination = columns.find((column) => column.id === columnId);
  // Moving inside the same column keeps the task count; elsewhere it grows by one.
  const slots = destination
    ? destination.tasks.filter((item) => item.id !== task.id).length + 1
    : 1;
  const safeIndex = Math.min(index, slots - 1);

  function changeColumn(nextId: string) {
    const next = columns.find((column) => column.id === nextId);
    const count = next ? next.tasks.filter((item) => item.id !== task.id).length + 1 : 1;
    setColumnId(nextId);
    setIndex(count - 1);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/tasks/${task.id}/move`, token, {
        method: 'PATCH',
        body: JSON.stringify({ destinationColumnId: columnId, destinationIndex: safeIndex }),
      });
      onMoved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Move failed. Try again.');
      setBusy(false);
    }
  }

  return (
    <Modal title="Move task" description={task.title} close={onClose}>
      <form onSubmit={handleSubmit}>
        <label>
          Column
          <select value={columnId} onChange={(event) => changeColumn(event.target.value)}>
            {columns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Position
          <select value={safeIndex} onChange={(event) => setIndex(Number(event.target.value))}>
            {Array.from({ length: slots }, (_, position) => (
              <option key={position} value={position}>
                {positionLabel(position, slots)}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p className="form-alert" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <Button busy={busy}>Move task</Button>
        </div>
      </form>
    </Modal>
  );
}
