/* eslint-disable react-hooks/refs */
'use client';

import { useRef, useState, type FormEvent } from 'react';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Column, Task } from '@/types';
import { TaskCard } from '@/components/task/task-card';
import { IconGrip, IconPencil, IconPlus, IconTrash } from '@/components/ui/icons';
import { Menu } from '@/components/ui/menu';
import { QuickAddTask } from './quick-add-task';

interface ColumnViewProps {
  column: Column;
  index: number;
  tasks: Task[];
  filtering: boolean;
  dragDisabled: boolean;
  isTaskDragging: boolean;
  quickOpen: boolean;
  quickBusy: boolean;
  onQuickOpen: () => void;
  onQuickClose: () => void;
  onQuickAdd: (title: string) => Promise<boolean>;
  onMoreOptions: (title: string) => void;
  onOpenTask: (task: Task) => void;
  onMoveTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onRename: (name: string) => Promise<boolean>;
  onDelete: () => void;
}

export function ColumnView({
  column,
  index,
  tasks,
  filtering,
  dragDisabled,
  isTaskDragging,
  quickOpen,
  quickBusy,
  onQuickOpen,
  onQuickClose,
  onQuickAdd,
  onMoreOptions,
  onOpenTask,
  onMoveTask,
  onDeleteTask,
  onRename,
  onDelete,
}: ColumnViewProps) {
  const sortable = useSortable({
    id: column.id,
    data: { type: 'column' },
    disabled: dragDisabled,
  });
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(column.name);

  // Enter, Escape and blur can all end an edit; only the first one counts.
  const finishedRef = useRef(false);

  function startRename() {
    finishedRef.current = false;
    setDraftName(column.name);
    setEditing(true);
  }

  async function submitRename(event?: FormEvent) {
    event?.preventDefault();
    if (finishedRef.current) return;
    finishedRef.current = true;
    const name = draftName.trim();
    setEditing(false);
    if (name && name !== column.name) await onRename(name);
  }

  const style = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
  };
  const isOver = isTaskDragging && sortable.isOver;
  const classes = ['column', isOver && 'column-over', sortable.isDragging && 'is-dragging']
    .filter(Boolean)
    .join(' ');

  return (
    <section
      ref={sortable.setNodeRef}
      style={style}
      className={classes}
      aria-label={`${column.name} column`}
    >
      <div className="column-header">
        <button
          type="button"
          className="column-grip"
          aria-label={`Drag ${column.name} column`}
          title={dragDisabled ? 'Clear filters to reorder' : 'Drag to reorder column'}
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <IconGrip />
        </button>
        <span className="column-dot" style={{ background: `var(--dot-${index % 5})` }} aria-hidden="true" />
        {editing ? (
          <form className="column-rename" onSubmit={submitRename}>
            <input
              autoFocus
              value={draftName}
              maxLength={100}
              onChange={(event) => setDraftName(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              onBlur={() => void submitRename()}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation();
                  finishedRef.current = true;
                  setEditing(false);
                }
              }}
              aria-label={`Rename ${column.name}`}
            />
          </form>
        ) : (
          <button
            type="button"
            className="column-name"
            title="Click to rename"
            onClick={startRename}
          >
            {column.name}
          </button>
        )}
        <span className="task-count" aria-label={`${column.tasks.length} tasks`}>
          {filtering ? `${tasks.length}/${column.tasks.length}` : column.tasks.length}
        </span>
        <Menu
          label={`Actions for ${column.name} column`}
          items={[
            { label: 'Add task', icon: <IconPlus />, onSelect: onQuickOpen },
            { label: 'Rename', icon: <IconPencil />, onSelect: startRename },
            { label: 'Delete', icon: <IconTrash />, danger: true, onSelect: onDelete },
          ]}
        />
      </div>

      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="task-list">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              dragDisabled={dragDisabled}
              open={() => onOpenTask(task)}
              move={() => onMoveTask(task)}
              remove={() => onDeleteTask(task)}
            />
          ))}
          {tasks.length === 0 && (
            <p className="column-empty">
              {filtering && column.tasks.length > 0 ? 'No matching tasks' : 'No tasks yet'}
              {!filtering && <span>Drop a task here or add one below</span>}
            </p>
          )}
        </div>
      </SortableContext>

      {quickOpen ? (
        <QuickAddTask
          busy={quickBusy}
          onSubmit={onQuickAdd}
          onMoreOptions={onMoreOptions}
          onClose={onQuickClose}
        />
      ) : (
        <button type="button" className="add-task" onClick={onQuickOpen}>
          <IconPlus /> Add task
        </button>
      )}
    </section>
  );
}
