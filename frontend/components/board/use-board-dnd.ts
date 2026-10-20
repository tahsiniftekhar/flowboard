'use client';

import { useRef, useState } from 'react';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useQueryClient } from '@tanstack/react-query';

import type { Board, Column, Notice, Task } from '@/types';
import { api, ApiError } from '@/lib/api';
import { moveColumnInBoard, moveTaskInBoard, type DragType } from '@/lib/dnd';

interface UseBoardDndOptions {
  board: Board;
  token: string;
  notify: (notice: Notice) => void;
}

const typeOf = (item: { data: { current?: Record<string, unknown> } }) =>
  item.data.current?.type as DragType | undefined;

// Optimistic multi-container drag and drop for tasks and columns. The board query
// cache is updated while dragging; any failure restores the snapshot.
export function useBoardDnd({ board, token, notify }: UseBoardDndOptions) {
  const queryClient = useQueryClient();
  const boardKey = ['board', board.id];
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeColumn, setActiveColumn] = useState<Column | null>(null);
  const dragSnapshotRef = useRef<Board | null>(null);
  const draggingRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const current = () => queryClient.getQueryData<Board>(boardKey) ?? board;
  const restore = (snapshot: Board) => queryClient.setQueryData(boardKey, snapshot);
  const refetch = () => {
    if (!draggingRef.current) void queryClient.invalidateQueries({ queryKey: boardKey });
  };

  function onDragStart({ active }: DragStartEvent) {
    const activeId = String(active.id);
    const snapshot = current();
    dragSnapshotRef.current = snapshot;
    draggingRef.current = true;
    if (typeOf(active) === 'column') {
      setActiveColumn(snapshot.columns?.find((column) => column.id === activeId) ?? null);
    } else {
      const task = snapshot.columns?.flatMap((column) => column.tasks).find((t) => t.id === activeId);
      setActiveTask(task ?? null);
    }
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || typeOf(active) !== 'task') return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const currentBoard = current();
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

    queryClient.setQueryData(boardKey, moveTaskInBoard(currentBoard, activeId, overCol.id, destIndex));
  }

  async function finishColumnDrag(activeId: string, overId: string, snapshot: Board) {
    const columns = snapshot.columns ?? [];
    const from = columns.findIndex((column) => column.id === activeId);
    const to = columns.findIndex((column) => column.id === overId);
    if (from < 0 || to < 0 || from === to) return;

    queryClient.setQueryData(boardKey, moveColumnInBoard(snapshot, activeId, to));
    try {
      await api(`/columns/${activeId}/move`, token, {
        method: 'PATCH',
        body: JSON.stringify({ destinationIndex: to }),
      });
      refetch();
    } catch {
      restore(snapshot);
      notify({ text: 'Could not move the column. The board was restored.', error: true });
    }
  }

  async function finishTaskDrag(activeId: string, snapshot: Board) {
    const currentBoard = current();
    const destinationCol = currentBoard.columns?.find((col) => col.tasks.some((t) => t.id === activeId));
    const finalIndex = destinationCol?.tasks.findIndex((t) => t.id === activeId) ?? -1;
    if (!destinationCol || finalIndex < 0) return restore(snapshot);

    const initialCol = snapshot.columns?.find((col) => col.tasks.some((t) => t.id === activeId));
    const initialTask = initialCol?.tasks.find((t) => t.id === activeId);
    if (initialCol?.id === destinationCol.id && initialTask?.position === finalIndex) return;

    try {
      await api(`/tasks/${activeId}/move`, token, {
        method: 'PATCH',
        body: JSON.stringify({ destinationColumnId: destinationCol.id, destinationIndex: finalIndex }),
      });
      refetch();
    } catch (error) {
      restore(snapshot);
      refetch();
      // 409: a teammate moved this card first. Show their result, not ours.
      const conflict = error instanceof ApiError && error.status === 409;
      notify({
        text: conflict
          ? 'A teammate moved this card first. Showing the latest board.'
          : 'Move failed. Server state was restored.',
        error: !conflict,
      });
    }
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    const snapshot = dragSnapshotRef.current;
    const type = typeOf(active);
    setActiveTask(null);
    setActiveColumn(null);
    draggingRef.current = false;
    if (!snapshot) return;

    if (!over) return restore(snapshot);
    if (type === 'column') return finishColumnDrag(String(active.id), String(over.id), snapshot);
    return finishTaskDrag(String(active.id), snapshot);
  }

  function onDragCancel() {
    if (dragSnapshotRef.current) restore(dragSnapshotRef.current);
    draggingRef.current = false;
    setActiveTask(null);
    setActiveColumn(null);
  }

  return {
    sensors,
    activeTask,
    activeColumn,
    handlers: {
      onDragStart,
      onDragOver,
      onDragEnd: (event: DragEndEvent) => void onDragEnd(event),
      onDragCancel,
    },
  };
}
