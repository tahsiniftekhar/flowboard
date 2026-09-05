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
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import type { AuthUser } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TasksService } from './tasks.service.js';

class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;
}

class UpdateTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;
}

class MoveTaskDto {
  @IsUUID()
  destinationColumnId: string;

  @IsInt()
  @Min(0)
  destinationIndex: number;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('columns/:columnId/tasks')
  async createTask(
    @CurrentUser() user: AuthUser,
    @Param('columnId', new ParseUUIDPipe()) columnId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.createTask(
      columnId,
      user.id,
      dto.title,
      dto.description,
    );
  }

  @Patch('tasks/:id')
  async updateTask(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.updateTask(
      taskId,
      user.id,
      dto.title,
      dto.description,
    );
  }

  @Delete('tasks/:id')
  async deleteTask(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) taskId: string,
  ) {
    return this.tasksService.deleteTask(taskId, user.id);
  }

  @Patch('tasks/:taskId/move')
  async moveTask(
    @CurrentUser() user: AuthUser,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Body() dto: MoveTaskDto,
  ) {
    return this.tasksService.moveTask(
      taskId,
      user.id,
      dto.destinationColumnId,
      dto.destinationIndex,
    );
  }
}
