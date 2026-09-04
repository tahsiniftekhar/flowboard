'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { Board, Column, Member, Notice, Task, User } from '@/types';
import { api, ApiError } from '@/lib/api';
import { dropAnimationConfig, moveTaskInBoard } from '@/lib/dnd';

import { Button } from '@/components/ui/button';
import { ConfirmModal, Modal } from '@/components/ui/modal';
import { Status } from '@/components/ui/status';

import { BoardHeader } from './board-header';
import { AddColumnCard } from '@/components/column/add-column-card';
import { ColumnView } from '@/components/column/column-view';
import { DragPreview } from '@/components/task/drag-preview';
import { MoveTaskModal } from '@/components/task/move-task-modal';
import { TaskFormModal } from '@/components/task/task-form-modal';
import { MembersModal } from '@/components/members/members-modal';

interface BoardViewProps {
  board: Board;
  token: string;
  user: User;
  refresh: () => void;
}

export function BoardView({ board, token, user, refresh }: BoardViewProps) {
  const queryClient = useQueryClient();
  const columns = board.columns ?? [];
  const isOwner = board.ownerId === user.id;

  const memberPreviewQuery = useQuery({
    queryKey: ['members', board.id],
    queryFn: () => api<Member[]>(`/boards/${board.id}/members`, token),
    enabled: Boolean(token),
  });

  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState('');
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [quickColumnId, setQuickColumnId] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [removeTarget, setRemoveTarget] = useState<{
    type: 'task' | 'column';
    task?: Task;
    column?: Column;
  } | null>(null);
  const [taskToMove, setTaskToMove] = useState<Task | null>(null);
  const [columnToRename, setColumnToRename] = useState<{
    type: 'column';
    column: Column;
  } | null>(null);

  // Members modal state
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);

  // Drag and drop state
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const dragSnapshotRef = useRef<Board | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), notice.error ? 6000 : 3500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function mutate(key: string, work: () => Promise<unknown>, success: string) {
    setBusy(key);
    setNotice(null);
    try {
      await work();
      setNotice({ text: success });
      refresh();
      return true;
    } catch (err) {
      setNotice({
        text: err instanceof ApiError ? err.message : 'Could not complete that action. Try again.',
        error: true,
      });
      return false;
    } finally {
      setBusy('');
    }
  }

  async function handleRenameBoard(name: string) {
    await mutate(
      'rename-board',
      () =>
        api(`/boards/${board.id}`, token, {
          method: 'PATCH',
          body: JSON.stringify({ name }),
        }),
      'Board renamed',
    );
  }

  async function handleSaveTask(title: string, description: string) {
    if (!taskToEdit) return;
    const ok = await mutate(
      'task',
      () =>
        api(`/tasks/${taskToEdit.id}`, token, {
          method: 'PATCH',
          body: JSON.stringify({ title, description }),
        }),
      'Task updated',
    );
    if (ok) {
      setTaskToEdit(null);
    }
  }

  async function handleSubmitQuickTask(event: FormEvent) {
    event.preventDefault();
    if (!quickColumnId || !quickTitle.trim()) return;
    const title = quickTitle.trim();
    const ok = await mutate(
      'quick-task',
      () =>
        api(`/columns/${quickColumnId}/tasks`, token, {
          method: 'POST',
          body: JSON.stringify({ title }),
        }),
      'Task added',
    );
    if (ok) {
      setQuickColumnId(null);
      setQuickTitle('');
    }
  }

  async function handleRenameColumnInline(name: string, columnId: string) {
    return mutate(
      'rename-column',
      () => api(`/columns/${columnId}`, token, { method: 'PATCH', body: JSON.stringify({ name }) }),
      'Column renamed',
    );
  }

  async function handleSaveColumnRenameModal(event: FormEvent) {
    event.preventDefault();
    const input = event.currentTarget.querySelector('[name="name"]') as HTMLInputElement | null;
    if (!input?.value.trim() || !columnToRename) return;
    const ok = await mutate(
      'rename',
      () =>
        api(`/columns/${columnToRename.column.id}`, token, {
          method: 'PATCH',
          body: JSON.stringify({ name: input.value.trim() }),
        }),
      'Column updated',
    );
    if (ok) setColumnToRename(null);
  }

  async function handleAddColumn(name: string) {
    return mutate(
      'column',
      () =>
        api(`/boards/${board.id}/columns`, token, {
          method: 'POST',
          body: JSON.stringify({ name }),
        }),
      'Column added',
    );
  }

  async function handleDeleteConfirmed() {
    if (!removeTarget) return;
    const path =
      removeTarget.type === 'task'
        ? `/tasks/${removeTarget.task?.id}`
        : `/columns/${removeTarget.column?.id}`;
    const ok = await mutate(
      `delete-${removeTarget.type}`,
      () => api(path, token, { method: 'DELETE' }),
      `${removeTarget.type === 'task' ? 'Task' : 'Column'} deleted`,
    );
    if (ok) setRemoveTarget(null);
  }

  async function handleOpenMembers() {
    setIsMembersOpen(true);
    setIsLoadingMembers(true);
    setTaskToMove(null);
    try {
      const data = await api<Member[]>(`/boards/${board.id}/members`, token);
      setMembers(data);
    } catch {
      setNotice({ text: 'Could not load members.', error: true });
    } finally {
      setIsLoadingMembers(false);
    }
  }

  // Multi-container drag handlers
  function handleDragStart({ active }: DragStartEvent) {
    const activeId = String(active.id);
    const foundTask = columns.flatMap((col) => col.tasks).find((t) => t.id === activeId) ?? null;
    setActiveTask(foundTask);
    dragSnapshotRef.current = queryClient.getQueryData<Board>(['board', board.id]) ?? board;
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const boardKey = ['board', board.id];
    const currentBoard = queryClient.getQueryData<Board>(boardKey) ?? board;
    const allCols = currentBoard.columns ?? [];

    const activeCol = allCols.find((col) => col.tasks.some((t) => t.id === activeId));
    const overCol =
      allCols.find((col) => col.id === overId) ??
      allCols.find((col) => col.tasks.some((t) => t.id === overId));

    if (!activeCol || !overCol) return;

    const overTaskIndex = overCol.tasks.findIndex((t) => t.id === overId);
    const destIndex = overTaskIndex >= 0 ? overTaskIndex : overCol.tasks.length;

    const currentTask = activeCol.tasks.find((t) => t.id === activeId);
    if (!currentTask) return;
    if (activeCol.id === overCol.id && currentTask.position === destIndex) return;

    queryClient.setQueryData(
      boardKey,
      moveTaskInBoard(currentBoard, activeId, overCol.id, destIndex),
    );
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const snapshot = dragSnapshotRef.current;
    setActiveTask(null);

    if (!over || !snapshot) {
      if (snapshot) queryClient.setQueryData(['board', board.id], snapshot);
      return;
    }

    const boardKey = ['board', board.id];
    const currentBoard = queryClient.getQueryData<Board>(boardKey) ?? board;
    const allCols = currentBoard.columns ?? [];

    const activeId = String(active.id);
    const destinationCol = allCols.find((col) => col.tasks.some((t) => t.id === activeId));
    if (!destinationCol) {
      if (snapshot) queryClient.setQueryData(boardKey, snapshot);
      return;
    }

    const finalIndex = destinationCol.tasks.findIndex((t) => t.id === activeId);
    if (finalIndex < 0) {
      if (snapshot) queryClient.setQueryData(boardKey, snapshot);
      return;
    }

    const initialCol = snapshot.columns?.find((col) => col.tasks.some((t) => t.id === activeId));
    const initialTask = initialCol?.tasks.find((t) => t.id === activeId);
    if (initialCol?.id === destinationCol.id && initialTask?.position === finalIndex) {
      return;
    }

    try {
      await api(`/tasks/${activeId}/move`, token, {
        method: 'PATCH',
        body: JSON.stringify({
          destinationColumnId: destinationCol.id,
          destinationIndex: finalIndex,
        }),
      });
    } catch {
      queryClient.setQueryData(boardKey, snapshot);
      setNotice({ text: 'Move failed. Server state was restored.', error: true });
    }
  }

  function handleDragCancel() {
    if (dragSnapshotRef.current) {
      queryClient.setQueryData(['board', board.id], dragSnapshotRef.current);
    }
    setActiveTask(null);
  }

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const currentColumns = board.columns ?? [];
      if (event.key.toLowerCase() === 'n' && currentColumns[0]) {
        event.preventDefault();
        setTaskToEdit(null);
        setQuickTitle('');
        setQuickColumnId((current) => current ?? currentColumns[0].id);
      } else if (event.key === '?') {
        setNotice({ text: 'Shortcuts: N adds a task. Escape closes menus. ? shows this message.' });
      } else if (event.key === 'Escape') {
        setQuickColumnId(null);
        setQuickTitle('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [board.columns]);

  const displayedMembers = members.length > 0 ? members : memberPreviewQuery.data ?? [];

  return (
    <section className="board-space">
      <BoardHeader
        board={board}
        isOwner={isOwner}
        members={displayedMembers}
        onRenameBoard={handleRenameBoard}
        onOpenMembers={() => void handleOpenMembers()}
      />

      {notice && <Status error={notice.error}>{notice.text}</Status>}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={(event) => void handleDragEnd(event)}
        onDragCancel={handleDragCancel}
      >
        <div className="kanban-grid">
          {columns.map((column) => (
            <ColumnView
              key={column.id}
              column={column}
              addTask={() => {
                setTaskToEdit(null);
                setQuickTitle('');
                setQuickColumnId(column.id);
              }}
              quickCreate={quickColumnId === column.id}
              quickTitle={quickTitle}
              setQuickTitle={setQuickTitle}
              submitQuickTask={handleSubmitQuickTask}
              cancelQuickTask={() => {
                setQuickColumnId(null);
                setQuickTitle('');
              }}
              quickBusy={busy === 'quick-task'}
              edit={(item) => setTaskToEdit(item)}
              move={(item) => setTaskToMove(item)}
              remove={(item) => setRemoveTarget({ type: 'task', task: item })}
              renameColumn={(name) => handleRenameColumnInline(name, column.id)}
              renameBusy={busy === 'rename-column'}
              deleteColumn={() => setRemoveTarget({ type: 'column', column })}
            />
          ))}

          <AddColumnCard
            busy={busy === 'column'}
            onAddColumn={handleAddColumn}
          />
        </div>

        <DragOverlay dropAnimation={dropAnimationConfig}>
          {activeTask ? <DragPreview task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

      <TaskFormModal
        task={taskToEdit}
        isOpen={Boolean(taskToEdit)}
        busy={busy === 'task'}
        error={notice?.error ? notice.text : ''}
        onClose={() => setTaskToEdit(null)}
        onSubmit={handleSaveTask}
      />

      {columnToRename && (
        <Modal title="Rename column" close={() => setColumnToRename(null)}>
          <form onSubmit={handleSaveColumnRenameModal}>
            <label>
              Name
              <input
                name="name"
                autoFocus
                defaultValue={columnToRename.column.name}
              />
            </label>
            {notice?.error && (
              <p className="error" role="alert">
                {notice.text}
              </p>
            )}
            <div className="confirm-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setColumnToRename(null)}
              >
                Cancel
              </button>
              <Button busy={busy === 'rename'}>Save changes</Button>
            </div>
          </form>
        </Modal>
      )}

      {taskToMove && (
        <MoveTaskModal
          task={taskToMove}
          columns={columns}
          token={token}
          onClose={() => setTaskToMove(null)}
          onSuccess={refresh}
          setNotice={setNotice}
        />
      )}

      {removeTarget && (
        <ConfirmModal
          title={`Delete “${removeTarget.type === 'task' ? removeTarget.task?.title : removeTarget.column?.name}”?`}
          description={
            removeTarget.type === 'task'
              ? 'This task will be permanently removed.'
              : 'This column and all its tasks will be permanently removed.'
          }
          busy={busy === `delete-${removeTarget.type}`}
          onConfirm={() => void handleDeleteConfirmed()}
          onCancel={() => setRemoveTarget(null)}
        />
      )}

      <MembersModal
        board={board}
        members={members}
        isLoading={isLoadingMembers}
        token={token}
        isOwner={isOwner}
        isOpen={isMembersOpen}
        onClose={() => setIsMembersOpen(false)}
        onMembersUpdated={() => void handleOpenMembers()}
        setNotice={setNotice}
      />
    </section>
  );
}
