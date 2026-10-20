'use client';

import { useState, type FormEvent } from 'react';
import type { Board, Task, TaskPriority } from '@/types';
import { api, ApiError } from '@/lib/api';
import { dueDay, PRIORITIES, priorityOf } from '@/lib/task-utils';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { IconTrash } from '@/components/ui/icons';

export type TaskModalTarget =
  | { mode: 'edit'; task: Task }
  | { mode: 'create'; columnId: string; title?: string };

interface TaskDetailModalProps {
  target: TaskModalTarget;
  board: Board;
  token: string;
  onClose: () => void;
  onSaved: (message: string) => void;
  onDelete: (task: Task) => void;
}

export function TaskDetailModal({
  target,
  board,
  token,
  onClose,
  onSaved,
  onDelete,
}: TaskDetailModalProps) {
  const task = target.mode === 'edit' ? target.task : null;
  const columns = board.columns ?? [];
  const members = board.members ?? [];

  const [title, setTitle] = useState(task?.title ?? (target.mode === 'create' ? target.title ?? '' : ''));
  const [description, setDescription] = useState(task?.description ?? '');
  const [priority, setPriority] = useState<TaskPriority>(task ? priorityOf(task) : 'MEDIUM');
  const [dueDate, setDueDate] = useState(dueDay(task?.dueDate));
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? '');
  const [columnId, setColumnId] = useState(target.mode === 'create' ? target.columnId : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const currentColumn = columns.find((column) => column.id === (task?.columnId ?? columnId));

  function changes() {
    if (!task) return {};
    const patch: Record<string, unknown> = {};
    if (title.trim() !== task.title) patch.title = title.trim();
    if ((description.trim() || null) !== (task.description || null)) {
      patch.description = description.trim() || null;
    }
    if (priority !== priorityOf(task)) patch.priority = priority;
    if ((dueDate || null) !== (dueDay(task.dueDate) || null)) patch.dueDate = dueDate || null;
    if ((assigneeId || null) !== (task.assigneeId ?? null)) patch.assigneeId = assigneeId || null;
    return patch;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || busy) return;
    setError('');

    let request: Promise<unknown>;
    if (task) {
      const patch = changes();
      if (Object.keys(patch).length === 0) return onClose();
      request = api(`/tasks/${task.id}`, token, { method: 'PATCH', body: JSON.stringify(patch) });
    } else {
      request = api(`/columns/${columnId}/tasks`, token, {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          ...(description.trim() && { description: description.trim() }),
          priority,
          ...(dueDate && { dueDate }),
          ...(assigneeId && { assigneeId }),
        }),
      });
    }

    setBusy(true);
    try {
      await request;
      onSaved(task ? 'Task updated' : 'Task added');
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the task. Try again.');
      setBusy(false);
    }
  }

  return (
    <Modal title={task ? 'Task details' : 'New task'} close={onClose} size="lg">
      <form className="task-form" onSubmit={handleSubmit}>
        <label>
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What needs to be done?"
            maxLength={200}
            required
          />
        </label>
        <label>
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Add more details..."
            rows={4}
            maxLength={5000}
          />
        </label>
        <div className="form-grid">
          <label>
            Priority
            <select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
              {PRIORITIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Assignee
            <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Due date
            <span className="date-field">
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              {dueDate && (
                <button type="button" className="text-button" onClick={() => setDueDate('')}>
                  Clear
                </button>
              )}
            </span>
          </label>
          {task ? (
            <div className="form-static">
              Column
              <span>{currentColumn?.name ?? 'Unknown'}</span>
            </div>
          ) : (
            <label>
              Column
              <select value={columnId} onChange={(event) => setColumnId(event.target.value)}>
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {error && (
          <p className="form-alert" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions task-form-actions">
          {task && (
            <button
              type="button"
              className="danger-ghost"
              onClick={() => onDelete(task)}
              disabled={busy}
            >
              <IconTrash /> Delete
            </button>
          )}
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <Button busy={busy} disabled={!title.trim()}>
            {task ? 'Save changes' : 'Add task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
