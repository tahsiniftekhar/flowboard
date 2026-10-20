import { Injectable, NotFoundException } from '@nestjs/common';
import { BoardsService } from '../boards/boards.service.js';
import type { Prisma } from '../generated/prisma/client.js';
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
      await lockBoard(transaction, boardId);
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

  async moveColumn(columnId: string, userId: string, destinationIndex: number) {
    const column = await this.prisma.column.findUnique({
      where: { id: columnId },
      select: { boardId: true },
    });

    if (!column) {
      throw new NotFoundException('Column not found');
    }

    await this.boardsService.requireBoardAccess(column.boardId, userId);

    return this.prisma.$transaction(
      async (transaction) => {
        await lockBoard(transaction, column.boardId);
        const columns = await transaction.column.findMany({
          where: { boardId: column.boardId },
          orderBy: { position: 'asc' },
          select: { id: true },
        });

        const ordered = columns.filter((item) => item.id !== columnId);
        const targetIndex = Math.min(destinationIndex, ordered.length);
        ordered.splice(targetIndex, 0, { id: columnId });

        // Shift out of the way first so the unique (boardId, position)
        // constraint never sees two columns at the same position.
        await transaction.column.updateMany({
          where: { boardId: column.boardId },
          data: { position: { increment: columns.length + 100000 } },
        });

        for (const [position, item] of ordered.entries()) {
          await transaction.column.update({
            where: { id: item.id },
            data: { position },
          });
        }

        return transaction.column.findMany({
          where: { boardId: column.boardId },
          orderBy: { position: 'asc' },
        });
      },
      { timeout: 15000 },
    );
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
      await lockBoard(transaction, column.boardId);
      // Re-read under the lock: a concurrent reorder may have shifted it.
      const { position } = await transaction.column.findUniqueOrThrow({
        where: { id: columnId },
        select: { position: true },
      });
      await transaction.column.delete({ where: { id: columnId } });
      await transaction.column.updateMany({
        where: {
          boardId: column.boardId,
          position: { gt: position },
        },
        data: { position: { decrement: 1 } },
      });
    });

    return { success: true };
  }
}

/**
 * Column positions are dense per board, so every write that shifts them
 * holds the board row lock until the transaction ends.
 */
async function lockBoard(
  transaction: Prisma.TransactionClient,
  boardId: string,
) {
  await transaction.$queryRaw`SELECT id FROM "Board" WHERE id = ${boardId}::uuid`;
}
