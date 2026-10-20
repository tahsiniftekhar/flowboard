'use client';

import type { RefObject } from 'react';
import type { Member, TaskPriority } from '@/types';
import { EMPTY_FILTERS, PRIORITIES, hasActiveFilters, type TaskFilters } from '@/lib/task-utils';
import { IconSearch } from '@/components/ui/icons';

interface BoardToolbarProps {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  members: Member[];
  userId: string;
  matchCount: number;
  totalCount: number;
  searchRef: RefObject<HTMLInputElement | null>;
}

export function BoardToolbar({
  filters,
  onChange,
  members,
  userId,
  matchCount,
  totalCount,
  searchRef,
}: BoardToolbarProps) {
  const active = hasActiveFilters(filters);
  const others = members.filter((member) => member.userId !== userId);

  return (
    <div className="board-toolbar" role="search">
      <div className="search-field">
        <IconSearch />
        <input
          ref={searchRef}
          type="search"
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              if (filters.query) onChange({ ...filters, query: '' });
              else event.currentTarget.blur();
            }
          }}
          placeholder="Search tasks"
          aria-label="Search tasks"
        />
        <kbd aria-hidden="true">/</kbd>
      </div>
      <select
        value={filters.priority}
        onChange={(event) => onChange({ ...filters, priority: event.target.value as 'ALL' | TaskPriority })}
        aria-label="Filter by priority"
      >
        <option value="ALL">Any priority</option>
        {PRIORITIES.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <select
        value={filters.assignee}
        onChange={(event) => onChange({ ...filters, assignee: event.target.value })}
        aria-label="Filter by assignee"
      >
        <option value="ANY">Anyone</option>
        <option value="ME">Assigned to me</option>
        <option value="NONE">Unassigned</option>
        {others.map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.user.name}
          </option>
        ))}
      </select>
      {active && (
        <>
          <button type="button" className="text-button" onClick={() => onChange(EMPTY_FILTERS)}>
            Clear filters
          </button>
          <span className="toolbar-count" aria-live="polite">
            {matchCount} of {totalCount} {totalCount === 1 ? 'task' : 'tasks'}
          </span>
          <span className="toolbar-hint">Clear filters to reorder</span>
        </>
      )}
    </div>
  );
}
