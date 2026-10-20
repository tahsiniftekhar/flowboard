import type { Task, TaskPriority } from '@/types';

export const PRIORITIES: Array<{ value: TaskPriority; label: string }> = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export function priorityOf(task: Pick<Task, 'priority'>): TaskPriority {
  return task.priority ?? 'MEDIUM';
}

export function priorityLabel(priority: TaskPriority) {
  return PRIORITIES.find((item) => item.value === priority)?.label ?? priority;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Due dates are stored at UTC midnight; read the calendar day from the string
// so local time zones can never shift it by one.
export function dueDay(iso?: string | null) {
  return iso ? iso.slice(0, 10) : '';
}

function parseDay(iso: string) {
  const [year, month, day] = dueDay(iso).split('-').map(Number);
  return { year, month, day };
}

export function formatDue(iso: string) {
  const { month, day } = parseDay(iso);
  return `${MONTHS[month - 1] ?? ''} ${day}`;
}

export type DueState = 'overdue' | 'today' | 'soon' | 'later';

export function dueState(iso: string, now = new Date()): DueState {
  const { year, month, day } = parseDay(iso);
  const due = Date.UTC(year, month - 1, day);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((due - today) / 86_400_000);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= 2) return 'soon';
  return 'later';
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

// Deterministic 1..6 tone so a person keeps the same colour everywhere.
export function avatarTone(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % 6) + 1;
}

export interface TaskFilters {
  query: string;
  priority: 'ALL' | TaskPriority;
  // 'ANY', 'ME', 'NONE', or a user id.
  assignee: string;
}

export const EMPTY_FILTERS: TaskFilters = { query: '', priority: 'ALL', assignee: 'ANY' };

export function hasActiveFilters(filters: TaskFilters) {
  return Boolean(filters.query.trim()) || filters.priority !== 'ALL' || filters.assignee !== 'ANY';
}

export function matchesFilters(task: Task, filters: TaskFilters, userId: string) {
  const query = filters.query.trim().toLowerCase();
  if (
    query &&
    !task.title.toLowerCase().includes(query) &&
    !(task.description ?? '').toLowerCase().includes(query)
  ) {
    return false;
  }
  if (filters.priority !== 'ALL' && priorityOf(task) !== filters.priority) return false;
  if (filters.assignee === 'NONE') return !task.assigneeId;
  if (filters.assignee === 'ME') return task.assigneeId === userId;
  if (filters.assignee !== 'ANY') return task.assigneeId === filters.assignee;
  return true;
}
