import type { Task } from '@/types';
import { dueState, formatDue, priorityLabel, priorityOf } from '@/lib/task-utils';
import { Avatar } from '@/components/ui/avatar';
import { IconCalendar, IconText } from '@/components/ui/icons';

// Priority / due date / description / assignee row shared by cards and drag previews.
export function TaskMeta({ task }: { task: Task }) {
  const priority = priorityOf(task);
  const hasMeta = priority !== 'MEDIUM' || task.dueDate || task.description || task.assignee;
  if (!hasMeta) return null;

  return (
    <div className="task-meta">
      {priority !== 'MEDIUM' && (
        <span className={`chip chip-priority prio-${priority.toLowerCase()}`}>
          {priorityLabel(priority)}
        </span>
      )}
      {task.dueDate && (
        <span className={`chip chip-due due-${dueState(task.dueDate)}`} title="Due date">
          <IconCalendar />
          {formatDue(task.dueDate)}
        </span>
      )}
      {task.description && (
        <span className="task-meta-icon" title="Has a description" aria-label="Has a description">
          <IconText />
        </span>
      )}
      {task.assignee && <Avatar user={task.assignee} size="sm" className="task-assignee" />}
    </div>
  );
}
