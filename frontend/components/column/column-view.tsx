/* eslint-disable react-hooks/refs */
'use client';

import { useState, type FormEvent } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Column, Task } from '@/types';
import { TaskCard } from '@/components/task/task-card';
import { IconPlus, IconTrash } from '@/components/ui/icons';

interface ColumnViewProps {
  column: Column;
  addTask: () => void;
  quickCreate: boolean;
  quickTitle: string;
  setQuickTitle: (value: string) => void;
  submitQuickTask: (event: FormEvent) => void;
  cancelQuickTask: () => void;
  quickBusy: boolean;
  edit: (task: Task) => void;
  move: (task: Task) => void;
  remove: (task: Task) => void;
  renameColumn: (name: string) => Promise<boolean>;
  renameBusy: boolean;
  deleteColumn: () => void;
}

export function ColumnView({
  column,
  addTask,
  quickCreate,
  quickTitle,
  setQuickTitle,
  submitQuickTask,
  cancelQuickTask,
  quickBusy,
  edit,
  move,
  remove,
  renameColumn,
  renameBusy,
  deleteColumn,
}: ColumnViewProps) {
  const drop = useDroppable({ id: column.id });
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(column.name);

  async function submitRename(event: FormEvent) {
    event.preventDefault();
    if (!draftName.trim()) return;
    const saved = await renameColumn(draftName.trim());
    if (saved) setEditing(false);
  }

  return (
    <div ref={drop.setNodeRef} className={`column ${drop.isOver ? 'column-over' : ''}`}>
      <div className="column-heading">
        <div>
          <span className="column-index">0{column.position + 1}</span>
          {editing ? (
            <form className="inline-column-name" onSubmit={submitRename}>
              <input
                autoFocus
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setEditing(false);
                }}
                aria-label={`Rename ${column.name}`}
              />
              <button type="submit" className="text-button" disabled={renameBusy}>
                Save
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="column-title-button"
              title={`Rename ${column.name}`}
              onClick={() => {
                setDraftName(column.name);
                setEditing(true);
              }}
            >
              {column.name}
            </button>
          )}
          <span className="task-count">{column.tasks.length}</span>
        </div>
        <div className="column-actions">
          <button
            type="button"
            className="column-delete-btn"
            title={`Delete ${column.name} column`}
            aria-label={`Delete ${column.name} column`}
            onClick={deleteColumn}
          >
            <IconTrash />
          </button>
        </div>
      </div>
      <SortableContext
        items={column.tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="task-list">
          {column.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              edit={() => edit(task)}
              move={() => move(task)}
              remove={() => remove(task)}
            />
          ))}
          {!column.tasks.length && (
            <p className="column-empty">No tasks yet. Add one to get started.</p>
          )}
        </div>
      </SortableContext>
      {quickCreate ? (
        <form className="quick-task" onSubmit={submitQuickTask}>
          <input
            autoFocus
            value={quickTitle}
            onChange={(event) => setQuickTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') cancelQuickTask();
            }}
            placeholder="Enter task title..."
            aria-label="New task title"
          />
          <div className="quick-task-actions">
            <button
              type="submit"
              className="button"
              disabled={quickBusy || !quickTitle.trim()}
            >
              <IconPlus /> {quickBusy ? 'Adding...' : 'Add'}
            </button>
            <button
              type="button"
              className="text-button"
              onClick={cancelQuickTask}
              disabled={quickBusy}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="add-task" onClick={addTask}>
          <IconPlus /> Add task
        </button>
      )}
    </div>
  );
}
