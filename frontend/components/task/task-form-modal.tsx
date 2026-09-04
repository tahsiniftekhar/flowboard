'use client';

import { useState, type FormEvent } from 'react';
import type { Task } from '@/types';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

interface TaskFormModalProps {
  task?: Task | null;
  isOpen: boolean;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (title: string, description: string) => void;
}

export function TaskFormModal({
  task,
  isOpen,
  busy,
  error = '',
  onClose,
  onSubmit,
}: TaskFormModalProps) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');

  if (!isOpen) return null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (title.trim()) {
      onSubmit(title.trim(), description.trim());
    }
  }

  return (
    <Modal
      title={task ? 'Edit task' : 'New task'}
      close={onClose}
    >
      <form onSubmit={handleSubmit}>
        <label>
          Title
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What needs to be done?"
            required
          />
        </label>
        <label>
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Add more details..."
            rows={3}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="confirm-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <Button busy={busy}>{task ? 'Save changes' : 'Add task'}</Button>
        </div>
      </form>
    </Modal>
  );
}
