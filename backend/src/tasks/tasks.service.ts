import { Injectable, NotFoundException } from '@nestjs/common';
import { BoardsService } from '../boards/boards.service';
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
}
