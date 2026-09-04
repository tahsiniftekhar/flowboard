import type { Task } from '@/types';
import { IconGrip } from '@/components/ui/icons';

interface DragPreviewProps {
  task: Task;
}

export function DragPreview({ task }: DragPreviewProps) {
  return (
    <article className="task-card drag-preview">
      <span className="drag-handle" aria-hidden="true">
        <IconGrip />
      </span>
      <div className="task-copy">
        <h4>{task.title}</h4>
        {task.description && <p>{task.description}</p>}
      </div>
    </article>
  );
}
