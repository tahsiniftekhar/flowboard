import {
  closestCenter,
  closestCorners,
  defaultDropAnimationSideEffects,
  type CollisionDetection,
  type DropAnimation,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { Board, Task } from '@/types';

export type DragType = 'column' | 'task';

// Columns only collide with other columns; tasks collide with tasks and columns
// (so they can be dropped into an empty column).
export const boardCollisionDetection: CollisionDetection = (args) => {
  if (args.active.data.current?.type === 'column') {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (container) => container.data.current?.type === 'column',
      ),
    });
  }
  return closestCorners(args);
};

export const dropAnimationConfig: DropAnimation = {
  duration: 200,
  easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.4',
      },
    },
  }),
};

export function moveTaskInBoard(
  board: Board,
  taskId: string,
  destinationColumnId: string,
  destinationIndex: number,
): Board {
  let movingTask: Task | undefined;
  const columns =
    board.columns?.map((column) => {
      const tasks = column.tasks.filter((task) => {
        if (task.id === taskId) movingTask = task;
        return task.id !== taskId;
      });
      return { ...column, tasks };
    }) ?? [];

  if (!movingTask) return board;

  const destination = columns.find((column) => column.id === destinationColumnId);
  if (!destination) return board;

  const index = Math.max(0, Math.min(destinationIndex, destination.tasks.length));
  destination.tasks.splice(index, 0, { ...movingTask, columnId: destinationColumnId });

  return {
    ...board,
    columns: columns.map((column) => ({
      ...column,
      tasks: column.tasks.map((task, position) => ({ ...task, position })),
    })),
  };
}

export function moveColumnInBoard(board: Board, columnId: string, destinationIndex: number): Board {
  const columns = board.columns ?? [];
  const from = columns.findIndex((column) => column.id === columnId);
  if (from < 0) return board;
  const to = Math.max(0, Math.min(destinationIndex, columns.length - 1));
  return {
    ...board,
    columns: arrayMove(columns, from, to).map((column, position) => ({ ...column, position })),
  };
}
