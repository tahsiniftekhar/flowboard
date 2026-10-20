/* eslint-disable react-hooks/refs */
'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '@/types';
import { priorityOf } from '@/lib/task-utils';
import { IconArrowRight, IconGrip, IconPencil, IconTrash } from '@/components/ui/icons';
import { Menu } from '@/components/ui/menu';
import { TaskMeta } from './task-meta';

interface TaskCardProps {
  task: Task;
  dragDisabled: boolean;
  open: () => void;
  move: () => void;
  remove: () => void;
}

export function TaskCard({ task, dragDisabled, open, move, remove }: TaskCardProps) {
  const sortable = useSortable({
    id: task.id,
    data: { type: 'task' },
    disabled: dragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <article
      ref={sortable.setNodeRef}
      style={style}
      className={`task-card prio-${priorityOf(task).toLowerCase()} ${sortable.isDragging ? 'is-dragging' : ''}`}
    >
      <button
        type="button"
        className="drag-handle"
        aria-label={`Drag ${task.title}`}
        title={dragDisabled ? 'Clear filters to reorder' : 'Drag to move'}
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <IconGrip />
      </button>
      <div className="task-main">
        <h4 className="task-title">
          <button type="button" className="task-open" onClick={open} title={task.title}>
            {task.title}
          </button>
        </h4>
        <TaskMeta task={task} />
      </div>
      <Menu
        label={`Actions for ${task.title}`}
        triggerClassName="menu-trigger task-menu-trigger"
        items={[
          { label: 'Edit', icon: <IconPencil />, onSelect: open },
          { label: 'Move to…', icon: <IconArrowRight />, onSelect: move },
          { label: 'Delete', icon: <IconTrash />, danger: true, onSelect: remove },
        ]}
      />
    </article>
  );
}
