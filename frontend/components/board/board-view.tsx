'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable';

import type { Board, Column, Task, User } from '@/types';
import { boardCollisionDetection, dropAnimationConfig } from '@/lib/dnd';
import { EMPTY_FILTERS, hasActiveFilters, matchesFilters, type TaskFilters } from '@/lib/task-utils';

import { ConfirmModal } from '@/components/ui/modal';
import { Toast, useToast } from '@/components/ui/status';
import { AddColumnCard } from '@/components/column/add-column-card';
import { ColumnView } from '@/components/column/column-view';
import { MembersModal } from '@/components/members/members-modal';
import { ColumnDragPreview, DragPreview } from '@/components/task/drag-preview';
import { MoveTaskModal } from '@/components/task/move-task-modal';
import { TaskDetailModal, type TaskModalTarget } from '@/components/task/task-detail-modal';

import { BoardHeader } from './board-header';
import { BoardToolbar } from './board-toolbar';
import { EmptyBoard } from './empty-board';
import { ShortcutsModal } from './shortcuts-modal';
import { useBoardActions } from './use-board-actions';
import { useBoardDnd } from './use-board-dnd';

interface BoardViewProps {
  board: Board;
  token: string;
  user: User;
}

const isTyping = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  return (
    !!element &&
    (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || element.isContentEditable)
  );
};

export function BoardView({ board, token, user }: BoardViewProps) {
  const columns = useMemo(() => board.columns ?? [], [board.columns]);
  const isOwner = board.ownerId === user.id;
  const members = board.members ?? [];
  const taskCount = columns.reduce((sum, column) => sum + column.tasks.length, 0);

  const { toast, notify, dismiss } = useToast();
  const actions = useBoardActions({ boardId: board.id, token, notify });
  const dnd = useBoardDnd({ board, token, notify });

  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS);
  const [quickColumnId, setQuickColumnId] = useState<string | null>(null);
  const [taskModal, setTaskModal] = useState<TaskModalTarget | null>(null);
  const [taskToMove, setTaskToMove] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [columnToDelete, setColumnToDelete] = useState<Column | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtering = hasActiveFilters(filters);
  const visibleTasks = useMemo(
    () =>
      new Map(
        columns.map((column) => [
          column.id,
          filtering ? column.tasks.filter((task) => matchesFilters(task, filters, user.id)) : column.tasks,
        ]),
      ),
    [columns, filters, filtering, user.id],
  );
  const matchCount = columns.reduce((sum, column) => sum + (visibleTasks.get(column.id)?.length ?? 0), 0);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      if (event.key === 'n' || event.key === 'N') {
        if (!columns[0]) return;
        event.preventDefault();
        setQuickColumnId(columns[0].id);
      } else if (event.key === '/') {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === '?') {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [columns]);

  async function confirmDeleteTask() {
    if (!taskToDelete) return;
    if (await actions.deleteTask(taskToDelete.id)) {
      setTaskToDelete(null);
      setTaskModal(null);
    }
  }

  async function confirmDeleteColumn() {
    if (!columnToDelete) return;
    if (await actions.deleteColumn(columnToDelete.id)) setColumnToDelete(null);
  }

  return (
    <section className="board-space">
      <BoardHeader
        board={board}
        token={token}
        userId={user.id}
        isOwner={isOwner}
        taskCount={taskCount}
        notify={notify}
        onOpenMembers={() => setMembersOpen(true)}
      />

      {columns.length > 0 && (
        <BoardToolbar
          filters={filters}
          onChange={setFilters}
          members={members}
          userId={user.id}
          matchCount={matchCount}
          totalCount={taskCount}
          searchRef={searchRef}
        />
      )}

      {columns.length === 0 ? (
        <EmptyBoard busy={actions.busy === 'add-column'} onAddSuggested={actions.addColumns} onAddColumn={actions.addColumn} />
      ) : (
        <DndContext sensors={dnd.sensors} collisionDetection={boardCollisionDetection} {...dnd.handlers}>
          <div className="kanban-grid">
            <SortableContext items={columns.map((column) => column.id)} strategy={horizontalListSortingStrategy}>
              {columns.map((column, index) => (
                <ColumnView
                  key={column.id}
                  column={column}
                  index={index}
                  tasks={visibleTasks.get(column.id) ?? column.tasks}
                  filtering={filtering}
                  dragDisabled={filtering}
                  isTaskDragging={dnd.activeTask !== null}
                  quickOpen={quickColumnId === column.id}
                  quickBusy={actions.busy === 'add-task'}
                  onQuickOpen={() => setQuickColumnId(column.id)}
                  onQuickClose={() => setQuickColumnId(null)}
                  onQuickAdd={(title) => actions.addTask(column.id, title)}
                  onMoreOptions={(title) => {
                    setQuickColumnId(null);
                    setTaskModal({ mode: 'create', columnId: column.id, title });
                  }}
                  onOpenTask={(task) => setTaskModal({ mode: 'edit', task })}
                  onMoveTask={setTaskToMove}
                  onDeleteTask={setTaskToDelete}
                  onRename={(name) => actions.renameColumn(column.id, name)}
                  onDelete={() => setColumnToDelete(column)}
                />
              ))}
            </SortableContext>
            <AddColumnCard busy={actions.busy === 'add-column'} onAddColumn={actions.addColumn} />
          </div>

          <DragOverlay dropAnimation={dropAnimationConfig}>
            {dnd.activeTask ? (
              <DragPreview task={dnd.activeTask} />
            ) : dnd.activeColumn ? (
              <ColumnDragPreview
                column={dnd.activeColumn}
                index={columns.findIndex((column) => column.id === dnd.activeColumn?.id)}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {taskModal && (
        <TaskDetailModal
          // Remount when switching tasks so the form state always matches the target.
          key={taskModal.mode === 'edit' ? taskModal.task.id : 'create'}
          target={taskModal}
          board={board}
          token={token}
          onClose={() => setTaskModal(null)}
          onSaved={(message) => {
            notify({ text: message });
            void actions.refresh();
          }}
          onDelete={setTaskToDelete}
        />
      )}

      {taskToMove && (
        <MoveTaskModal
          task={taskToMove}
          columns={columns}
          token={token}
          onClose={() => setTaskToMove(null)}
          onMoved={() => {
            notify({ text: 'Task moved' });
            void actions.refresh();
          }}
        />
      )}

      {taskToDelete && (
        <ConfirmModal
          title={`Delete “${taskToDelete.title}”?`}
          description="This task will be permanently removed."
          busy={actions.busy === 'delete-task'}
          onConfirm={() => void confirmDeleteTask()}
          onCancel={() => setTaskToDelete(null)}
        />
      )}

      {columnToDelete && (
        <ConfirmModal
          title={`Delete “${columnToDelete.name}”?`}
          description={
            columnToDelete.tasks.length > 0
              ? `This column and its ${columnToDelete.tasks.length} task${columnToDelete.tasks.length === 1 ? '' : 's'} will be permanently removed.`
              : 'This column will be permanently removed.'
          }
          busy={actions.busy === 'delete-column'}
          onConfirm={() => void confirmDeleteColumn()}
          onCancel={() => setColumnToDelete(null)}
        />
      )}

      {membersOpen && (
        <MembersModal
          board={board}
          token={token}
          isOwner={isOwner}
          onClose={() => setMembersOpen(false)}
          notify={notify}
        />
      )}

      {shortcutsOpen && <ShortcutsModal close={() => setShortcutsOpen(false)} />}

      <Toast toast={toast} onDismiss={dismiss} />
    </section>
  );
}
