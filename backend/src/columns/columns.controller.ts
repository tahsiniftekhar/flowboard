import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsNotEmpty, MaxLength } from 'class-validator';
import type { AuthUser } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ColumnsService } from './columns.service.js';

class ColumnNameDto {
  @IsNotEmpty()
  @MaxLength(80)
  name: string;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class ColumnsController {
  constructor(private readonly columnsService: ColumnsService) {}

  @Post('boards/:boardId/columns')
  async createColumn(
    @CurrentUser() user: AuthUser,
    @Param('boardId', new ParseUUIDPipe()) boardId: string,
    @Body() dto: ColumnNameDto,
  ) {
    return this.columnsService.createColumn(boardId, user.id, dto.name);
  }

  @Patch('columns/:id')
  async updateColumn(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) columnId: string,
    @Body() dto: ColumnNameDto,
  ) {
    return this.columnsService.updateColumn(columnId, user.id, dto.name);
  }

  @Delete('columns/:id')
  async deleteColumn(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) columnId: string,
  ) {
    return this.columnsService.deleteColumn(columnId, user.id);
  }
}
