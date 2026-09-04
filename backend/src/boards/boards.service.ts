import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BoardRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

export interface BoardAccess {
  boardId: string;
  userId: string;
  role: 'OWNER' | 'MEMBER';
}

@Injectable()
export class BoardsService {
  constructor(private readonly prisma: PrismaService) {}

  async createBoard(userId: string, name: string) {
    return this.prisma.board.create({
      data: {
        name,
        ownerId: userId,
        members: {
          create: [{ userId, role: BoardRole.OWNER }],
        },
      },
    });
  }

  async listBoards(userId: string) {
    return this.prisma.board.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBoardForUser(boardId: string, userId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      include: {
        members: true,
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!board) {
      throw new NotFoundException('Board not found');
    }

    const hasAccess =
      board.ownerId === userId ||
      board.members.some((member) => member.userId === userId);

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this board');
    }

    return board;
  }

  async updateBoard(boardId: string, userId: string, name: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      include: { members: true },
    });

    if (!board) {
      throw new NotFoundException('Board not found');
    }

    const isOwner = board.ownerId === userId;
    if (!isOwner) {
      throw new ForbiddenException(
        'Only the board owner can update this board',
      );
    }

    return this.prisma.board.update({
      where: { id: boardId },
      data: { name },
    });
  }

  async deleteBoard(boardId: string, userId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
    });

    if (!board) {
      throw new NotFoundException('Board not found');
    }

    if (board.ownerId !== userId) {
      throw new ForbiddenException(
        'Only the board owner can delete this board',
      );
    }

    await this.prisma.board.delete({ where: { id: boardId } });
    return { success: true };
  }

  async requireBoardAccess(
    boardId: string,
    userId: string,
  ): Promise<BoardAccess> {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      include: { members: true },
    });

    if (!board) {
      throw new NotFoundException('Board not found');
    }

    if (board.ownerId === userId) {
      return { boardId, userId, role: 'OWNER' };
    }

    const member = board.members.find((entry) => entry.userId === userId);
    if (!member) {
      throw new ForbiddenException('You do not have access to this board');
    }

    return {
      boardId,
      userId,
      role: member.role === BoardRole.OWNER ? 'OWNER' : 'MEMBER',
    };
  }
}
