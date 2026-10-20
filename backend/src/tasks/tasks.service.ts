import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BoardsService } from '../boards/boards.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { TaskPriority } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface TaskDetails {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  dueDate?: string | null;
  assigneeId?: string | null;
}

export const taskInclude = {
  assignee: { select: { id: true, name: true, email: true } },
} as const;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardsService: BoardsService,
  ) {}

  async createTask(
    columnId: string,
    userId: string,
    details: TaskDetails & { title: string },
  ) {
    const column = await this.prisma.column.findUnique({
      where: { id: columnId },
      select: { boardId: true },
    });

    if (!column) {
      throw new NotFoundException('Column not found');
    }

    await this.boardsService.requireBoardAccess(column.boardId, userId);
    await this.assertAssignable(column.boardId, details.assigneeId);

    return this.prisma.$transaction(async (transaction) => {
      await lockColumns(transaction, [columnId]);
      const lastTask = await transaction.task.findFirst({
        where: { columnId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      return transaction.task.create({
        data: {
          columnId,
          ...this.toTaskData(details),
          title: details.title,
          position: (lastTask?.position ?? -1) + 1,
        },
        include: taskInclude,
      });
    });
  }

  async updateTask(taskId: string, userId: string, details: TaskDetails) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        columnId: true,
        position: true,
        column: {
          select: { boardId: true },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.boardsService.requireBoardAccess(task.column.boardId, userId);
    await this.assertAssignable(task.column.boardId, details.assigneeId);

    return this.prisma.task.update({
      where: { id: taskId },
      data: this.toTaskData(details),
      include: taskInclude,
    });
  }

  // undefined leaves a field untouched; null clears it.
  private toTaskData(details: TaskDetails) {
    return {
      title: details.title,
      description: details.description,
      priority: details.priority,
      assigneeId: details.assigneeId,
      dueDate:
        details.dueDate === undefined
          ? undefined
          : details.dueDate === null
            ? null
            : new Date(details.dueDate),
    };
  }

  private async assertAssignable(
    boardId: string,
    assigneeId: string | null | undefined,
  ) {
    if (!assigneeId) return;
    const isMember = await this.boardsService.isBoardMember(
      boardId,
      assigneeId,
    );
    if (!isMember) {
      throw new BadRequestException(
        'Tasks can only be assigned to board members',
      );
    }
  }

  async deleteTask(taskId: string, userId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        columnId: true,
        position: true,
        column: {
          select: { boardId: true },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.boardsService.requireBoardAccess(task.column.boardId, userId);

    await this.prisma.$transaction(async (transaction) => {
      await lockColumns(transaction, [task.columnId]);
      // Re-read under the lock: a concurrent move may have changed it.
      const current = await transaction.task.findUnique({
        where: { id: taskId },
        select: { columnId: true, position: true },
      });
      if (!current) {
        throw new NotFoundException('Task not found');
      }
      if (current.columnId !== task.columnId) {
        throw new ConflictException('Task was moved, please retry');
      }

      await transaction.task.delete({ where: { id: taskId } });
      await transaction.task.updateMany({
        where: {
          columnId: current.columnId,
          position: { gt: current.position },
        },
        data: { position: { decrement: 1 } },
      });
    });
    return { success: true };
  }

  async moveTask(
    taskId: string,
    userId: string,
    destinationColumnId: string,
    destinationIndex: number,
  ) {
    const access = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        columnId: true,
        column: {
          select: { boardId: true },
        },
      },
    });

    if (!access) {
      throw new NotFoundException('Task not found');
    }

    await this.boardsService.requireBoardAccess(access.column.boardId, userId);

    return this.prisma.$transaction(async (transaction) => {
      // Serialize every write to the affected columns. Without this, two
      // concurrent moves read the same snapshot and their position shifts
      // collide on the (columnId, position) unique constraint.
      await lockColumns(transaction, [
        access.columnId,
        destinationColumnId,
      ]);

      const task = await transaction.task.findUnique({
        where: { id: taskId },
        select: {
          id: true,
          columnId: true,
          position: true,
          column: {
            select: { boardId: true },
          },
        },
      });
      const destinationColumn = await transaction.column.findUnique({
        where: { id: destinationColumnId },
        select: { id: true, boardId: true },
      });

      if (!task) {
        throw new NotFoundException('Task not found');
      }

      if (!destinationColumn) {
        throw new NotFoundException('Destination column not found');
      }

      if (task.column.boardId !== destinationColumn.boardId) {
        throw new ForbiddenException(
          'Tasks cannot be moved between different boards',
        );
      }

      if (task.columnId !== access.columnId) {
        throw new ConflictException('Task was moved, please retry');
      }

      const sourceColumnId = task.columnId;
      const sameColumn = sourceColumnId === destinationColumnId;

      if (sameColumn) {
        const currentTasks = await transaction.task.findMany({
          where: { columnId: sourceColumnId },
          orderBy: { position: 'asc' },
          select: { id: true },
        });

        const otherTasks = currentTasks.filter((item) => item.id !== taskId);
        const targetIndex = Math.min(
          Math.max(destinationIndex, 0),
          otherTasks.length,
        );

        otherTasks.splice(targetIndex, 0, { id: taskId });

        const tempOffset = currentTasks.length + 100000;
        await transaction.task.updateMany({
          where: { columnId: sourceColumnId },
          data: { position: { increment: tempOffset } },
        });

        await Promise.all(
          otherTasks.map((t, index) =>
            transaction.task.update({
              where: { id: t.id },
              data: { position: index },
            }),
          ),
        );
      } else {
        const [sourceTasks, destTasks] = await Promise.all([
          transaction.task.findMany({
            where: { columnId: sourceColumnId },
            orderBy: { position: 'asc' },
            select: { id: true },
          }),
          transaction.task.findMany({
            where: { columnId: destinationColumnId },
            orderBy: { position: 'asc' },
            select: { id: true },
          }),
        ]);

        const remainingSource = sourceTasks.filter((item) => item.id !== taskId);
        const targetIndex = Math.min(
          Math.max(destinationIndex, 0),
          destTasks.length,
        );
        destTasks.splice(targetIndex, 0, { id: taskId });

        const tempOffset = Math.max(sourceTasks.length, destTasks.length) + 100000;

        await Promise.all([
          remainingSource.length > 0
            ? transaction.task.updateMany({
                where: { columnId: sourceColumnId },
                data: { position: { increment: tempOffset } },
              })
            : Promise.resolve(),
          transaction.task.updateMany({
            where: { columnId: destinationColumnId },
            data: { position: { increment: tempOffset } },
          }),
        ]);

        await Promise.all([
          ...remainingSource.map((t, index) =>
            transaction.task.update({
              where: { id: t.id },
              data: { position: index },
            }),
          ),
          ...destTasks.map((t, index) =>
            transaction.task.update({
              where: { id: t.id },
              data: {
                columnId: destinationColumnId,
                position: index,
              },
            }),
          ),
        ]);
      }

      return transaction.task.findUniqueOrThrow({
        where: { id: taskId },
        include: taskInclude,
      });
    }, { timeout: 15000 });
  }
}

/**
 * Takes row locks on the given columns for the rest of the transaction.
 * Ids are sorted so two transactions touching the same pair of columns
 * always lock in the same order and cannot deadlock.
 */
async function lockColumns(
  transaction: Prisma.TransactionClient,
  columnIds: string[],
) {
  for (const id of [...new Set(columnIds)].sort()) {
    await transaction.$queryRaw`SELECT id FROM "Column" WHERE id = ${id}::uuid`;
  }
}
