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
  IsDateString,
  IsEnum,
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
import { TaskPriority } from '../generated/prisma/enums.js';
import { TasksService, type TaskDetails } from './tasks.service.js';

// Optional detail fields accept null on update so the client can clear them.
class TaskDetailsDto implements TaskDetails {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsDateString({ strict: true })
  dueDate?: string | null;

  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;
}

class CreateTaskDto extends TaskDetailsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;
}

class UpdateTaskDto extends TaskDetailsDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;
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
    return this.tasksService.createTask(columnId, user.id, dto);
  }

  @Patch('tasks/:id')
  async updateTask(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.updateTask(taskId, user.id, dto);
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
