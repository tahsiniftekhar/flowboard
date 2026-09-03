import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

export interface HealthStatus {
  status: 'ok';
  database: 'up';
}

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async health(): Promise<HealthStatus> {
    await this.prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
    return { status: 'ok', database: 'up' };
  }
}
