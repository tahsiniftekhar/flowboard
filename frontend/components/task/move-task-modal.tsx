'use client';

import { useState, type FormEvent } from 'react';
import type { Column, Notice, Task } from '@/types';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

interface MoveTaskModalProps {
  task: Task;
  columns: Column[];
  token: string;
  onClose: () => void;
  onSuccess: () => void;
  setNotice: (notice: Notice) => void;
}

export function MoveTaskModal({
  task,
  columns,
  token,
  onClose,
  onSuccess,
  setNotice,
}: MoveTaskModalProps) {
  const [columnId, setColumnId] = useState(task.columnId);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const destination = columns.find((column) => column.id === columnId);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`/tasks/${task.id}/move`, token, {
        method: 'PATCH',
        body: JSON.stringify({ destinationColumnId: columnId, destinationIndex: Number(index) }),
      });
      setNotice({ text: 'Task moved successfully' });
      onClose();
      onSuccess();
    } catch {
      setNotice({ text: 'Move failed. Try again.', error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Move “${task.title}”`} close={onClose}>
      <form onSubmit={handleSubmit}>
        <label>
          Destination column
          <select
            value={columnId}
            onChange={(event) => {
              setColumnId(event.target.value);
              setIndex(0);
            }}
          >
            {columns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Position
          <input
            type="number"
            min="0"
            max={destination?.tasks.length ?? 0}
            value={index}
            onChange={(event) => setIndex(Number(event.target.value))}
          />
        </label>
        <div className="confirm-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <Button busy={busy}>Move task</Button>
        </div>
      </form>
    </Modal>
  );
}
