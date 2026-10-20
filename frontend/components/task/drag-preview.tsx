import type { Column, Task } from '@/types';
import { priorityOf } from '@/lib/task-utils';
import { IconGrip } from '@/components/ui/icons';
import { TaskMeta } from './task-meta';

export function DragPreview({ task }: { task: Task }) {
  return (
    <article className={`task-card drag-preview prio-${priorityOf(task).toLowerCase()}`}>
      <span className="drag-handle" aria-hidden="true">
        <IconGrip />
      </span>
      <div className="task-main">
        <h4 className="task-title">
          <span className="task-open">{task.title}</span>
        </h4>
        <TaskMeta task={task} />
      </div>
    </article>
  );
}

export function ColumnDragPreview({ column, index }: { column: Column; index: number }) {
  return (
    <div className="column column-preview">
      <div className="column-header">
        <span className="column-grip" aria-hidden="true">
          <IconGrip />
        </span>
        <span className="column-dot" style={{ background: `var(--dot-${index % 5})` }} />
        <span className="column-name">{column.name}</span>
        <span className="task-count">{column.tasks.length}</span>
      </div>
      <div className="task-list">
        {column.tasks.slice(0, 4).map((task) => (
          <DragPreview key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
