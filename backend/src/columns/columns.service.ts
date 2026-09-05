import { Injectable, NotFoundException } from '@nestjs/common';
import { BoardsService } from '../boards/boards.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ColumnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardsService: BoardsService,
  ) {}

  async createColumn(boardId: string, userId: string, name: string) {
    await this.boardsService.requireBoardAccess(boardId, userId);

    return this.prisma.$transaction(async (transaction) => {
      const lastColumn = await transaction.column.findFirst({
        where: { boardId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      return transaction.column.create({
        data: {
          boardId,
          name,
          position: (lastColumn?.position ?? -1) + 1,
        },
      });
    });
  }

  async updateColumn(columnId: string, userId: string, name: string) {
    const column = await this.prisma.column.findUnique({
      where: { id: columnId },
      select: { id: true, boardId: true },
    });

    if (!column) {
      throw new NotFoundException('Column not found');
    }

    await this.boardsService.requireBoardAccess(column.boardId, userId);

    return this.prisma.column.update({
      where: { id: columnId },
      data: { name },
    });
  }

  async deleteColumn(columnId: string, userId: string) {
    const column = await this.prisma.column.findUnique({
      where: { id: columnId },
      select: { id: true, boardId: true, position: true },
    });

    if (!column) {
      throw new NotFoundException('Column not found');
    }

    await this.boardsService.requireBoardAccess(column.boardId, userId);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.column.delete({ where: { id: columnId } });
      await transaction.column.updateMany({
        where: {
          boardId: column.boardId,
          position: { gt: column.position },
        },
        data: { position: { decrement: 1 } },
      });
    });

    return { success: true };
  }
}
