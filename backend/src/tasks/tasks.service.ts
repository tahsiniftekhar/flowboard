import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BoardsService } from '../boards/boards.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

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

      return transaction.task.findUniqueOrThrow({ where: { id: taskId } });
    }, { timeout: 15000 });
  }
}
