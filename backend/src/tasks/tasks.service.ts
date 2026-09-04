import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BoardsService } from '../boards/boards.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardsService: BoardsService,
  ) {}

  async createTask(
    columnId: string,
    userId: string,
    title: string,
    description?: string,
  ) {
    const column = await this.prisma.column.findUnique({
      where: { id: columnId },
      select: { boardId: true },
    });

    if (!column) {
      throw new NotFoundException('Column not found');
    }

    await this.boardsService.requireBoardAccess(column.boardId, userId);

    return this.prisma.$transaction(async (transaction) => {
      const lastTask = await transaction.task.findFirst({
        where: { columnId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      return transaction.task.create({
        data: {
          columnId,
          title,
          description,
          position: (lastTask?.position ?? -1) + 1,
        },
      });
    });
  }

  async updateTask(
    taskId: string,
    userId: string,
    title: string,
    description?: string,
  ) {
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

    return this.prisma.task.update({
      where: { id: taskId },
      data: { title, description },
    });
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
      await transaction.task.delete({ where: { id: taskId } });
      await transaction.task.updateMany({
        where: {
          columnId: task.columnId,
          position: { gt: task.position },
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

      const sourceColumnId = task.columnId;
      const sameColumn = sourceColumnId === destinationColumnId;
      const destinationCount = await transaction.task.count({
        where: { columnId: destinationColumnId },
      });
      const availableDestinationLength = sameColumn
        ? Math.max(destinationCount - 1, 0)
        : destinationCount;
      const targetIndex = Math.min(
        Math.max(destinationIndex, 0),
        availableDestinationLength,
      );

      if (sameColumn && targetIndex === task.position) {
        return transaction.task.findUniqueOrThrow({ where: { id: taskId } });
      }

      const temporaryPosition = 2_147_483_647;
      await transaction.task.update({
        where: { id: taskId },
        data: { position: temporaryPosition },
      });

      if (sameColumn) {
        if (targetIndex < task.position) {
          await transaction.task.updateMany({
            where: {
              columnId: sourceColumnId,
              position: { gte: targetIndex, lt: task.position },
            },
            data: { position: { increment: 1 } },
          });
        } else {
          await transaction.task.updateMany({
            where: {
              columnId: sourceColumnId,
              position: { gt: task.position, lte: targetIndex },
            },
            data: { position: { decrement: 1 } },
          });
        }

        await transaction.task.update({
          where: { id: taskId },
          data: { position: targetIndex },
        });
        await this.normalizeTaskPositions(transaction, sourceColumnId);
      } else {
        await transaction.task.updateMany({
          where: {
            columnId: sourceColumnId,
            position: { gt: task.position },
          },
          data: { position: { decrement: 1 } },
        });
        await transaction.task.updateMany({
          where: {
            columnId: destinationColumnId,
            position: { gte: targetIndex },
          },
          data: { position: { increment: 1 } },
        });
        await transaction.task.update({
          where: { id: taskId },
          data: {
            columnId: destinationColumnId,
            position: targetIndex,
          },
        });
        await this.normalizeTaskPositions(transaction, sourceColumnId);
        await this.normalizeTaskPositions(transaction, destinationColumnId);
      }

      return transaction.task.findUniqueOrThrow({ where: { id: taskId } });
    });
  }

  private async normalizeTaskPositions(
    transaction: Prisma.TransactionClient,
    columnId: string,
  ) {
    const tasks = await transaction.task.findMany({
      where: { columnId },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });

    if (tasks.length === 0) {
      return;
    }

    await transaction.task.updateMany({
      where: { columnId },
      data: { position: { increment: tasks.length + 1 } },
    });

    for (const [position, task] of tasks.entries()) {
      await transaction.task.update({
        where: { id: task.id },
        data: { position },
      });
    }
  }
}
