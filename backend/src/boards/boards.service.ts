import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BoardRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

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
    const boards = await this.prisma.board.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        owner: { select: { id: true, name: true } },
        _count: { select: { members: true, columns: true } },
        columns: { select: { _count: { select: { tasks: true } } } },
      },
    });

    return boards.map(({ _count, columns, ...board }) => ({
      ...board,
      role: board.ownerId === userId ? 'OWNER' : 'MEMBER',
      memberCount: _count.members,
      columnCount: _count.columns,
      taskCount: columns.reduce((sum, column) => sum + column._count.tasks, 0),
    }));
  }

  async getBoardForUser(boardId: string, userId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      include: {
        members: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        owner: {
          select: { id: true, name: true, email: true },
        },
        columns: {
          orderBy: { position: 'asc' },
          include: {
            tasks: {
              orderBy: { position: 'asc' },
              include: {
                assignee: { select: { id: true, name: true, email: true } },
              },
            },
          },
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

  async isBoardMember(boardId: string, userId: string) {
    const membership = await this.prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId } },
      select: { id: true },
    });
    if (membership) return true;

    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { ownerId: true },
    });
    return board?.ownerId === userId;
  }

  private async requireBoardOwner(boardId: string, userId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
    });

    if (!board) {
      throw new NotFoundException('Board not found');
    }

    if (board.ownerId !== userId) {
      throw new ForbiddenException(
        'Only the board owner can manage membership',
      );
    }

    return board;
  }

  async listMembers(boardId: string, userId: string) {
    await this.requireBoardAccess(boardId, userId);

    return this.prisma.boardMember.findMany({
      where: { boardId },
      select: {
        id: true,
        boardId: true,
        userId: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMember(boardId: string, ownerId: string, email: string) {
    await this.requireBoardOwner(boardId, ownerId);

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingMembership = await this.prisma.boardMember.findUnique({
      where: {
        boardId_userId: { boardId, userId: user.id },
      },
    });

    if (existingMembership) {
      throw new ConflictException('User is already a board member');
    }

    return this.prisma.boardMember.create({
      data: {
        boardId,
        userId: user.id,
        role: BoardRole.MEMBER,
      },
      select: {
        id: true,
        boardId: true,
        userId: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  async removeMember(boardId: string, actorId: string, userId: string) {
    // Members may remove themselves (leave); only the owner may remove others.
    if (actorId === userId) {
      const access = await this.requireBoardAccess(boardId, actorId);
      if (access.role === 'OWNER') {
        throw new ForbiddenException('The board owner cannot leave the board');
      }
    } else {
      const board = await this.requireBoardOwner(boardId, actorId);
      if (board.ownerId === userId) {
        throw new ForbiddenException('The board owner cannot be removed');
      }
    }

    const membership = await this.prisma.boardMember.findUnique({
      where: {
        boardId_userId: { boardId, userId },
      },
    });

    if (!membership) {
      throw new NotFoundException('Board member not found');
    }

    await this.prisma.$transaction([
      this.prisma.task.updateMany({
        where: { assigneeId: userId, column: { boardId } },
        data: { assigneeId: null },
      }),
      this.prisma.boardMember.delete({
        where: { boardId_userId: { boardId, userId } },
      }),
    ]);

    return { success: true };
  }
}
