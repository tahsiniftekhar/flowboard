import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BoardsModule } from '../boards/boards.module.js';
import { ColumnsController } from './columns.controller.js';
import { ColumnsService } from './columns.service.js';

@Module({
  imports: [AuthModule, BoardsModule],
  controllers: [ColumnsController],
  providers: [ColumnsService],
})
export class ColumnsModule {}
