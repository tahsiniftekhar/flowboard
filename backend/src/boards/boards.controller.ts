import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';
import { AuthUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BoardsService } from './boards.service';

class CreateBoardDto {
  @IsNotEmpty()
  @MaxLength(120)
  name: string;
}

class UpdateBoardDto {
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;
}

class AddMemberDto {
  @IsEmail()
  email: string;
}

@Controller('boards')
@UseGuards(JwtAuthGuard)
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  @Post()
  async createBoard(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateBoardDto,
  ) {
    return this.boardsService.createBoard(user.id, dto.name);
  }

  @Get()
  async listBoards(@CurrentUser() user: AuthUser) {
    return this.boardsService.listBoards(user.id);
  }

  @Get(':id')
  async getBoard(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.boardsService.getBoardForUser(id, user.id);
  }

  @Patch(':id')
  async updateBoard(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateBoardDto,
  ) {
    return this.boardsService.updateBoard(id, user.id, dto.name ?? '');
  }

  @Delete(':id')
  async deleteBoard(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.boardsService.deleteBoard(id, user.id);
  }

  @Post(':boardId/members')
  async addMember(
    @CurrentUser() user: AuthUser,
    @Param('boardId') boardId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.boardsService.addMember(boardId, user.id, dto.email);
  }

  @Get(':boardId/members')
  async listMembers(
    @CurrentUser() user: AuthUser,
    @Param('boardId') boardId: string,
  ) {
    return this.boardsService.listMembers(boardId, user.id);
  }

  @Delete(':boardId/members/:userId')
  async removeMember(
    @CurrentUser() user: AuthUser,
    @Param('boardId') boardId: string,
    @Param('userId') userId: string,
  ) {
    return this.boardsService.removeMember(boardId, user.id, userId);
  }
}
