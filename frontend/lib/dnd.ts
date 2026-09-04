import { defaultDropAnimationSideEffects, type DropAnimation } from '@dnd-kit/core';
import type { Board, Task } from '@/types';

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
