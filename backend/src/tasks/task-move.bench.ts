import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TasksService } from './tasks.service.js';

// Times TasksService.moveTask on 30-card columns: the access check, the
// column locks and the full position rewrite, without HTTP. Not part of
// `pnpm test`; run with `pnpm bench`.
const CARDS = 30;
const RUNS = 200;

describe('Move cost on a 30-card column', () => {
  let prisma: PrismaService;
  let tasks: TasksService;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    prisma = moduleRef.get(PrismaService);
    tasks = moduleRef.get(TasksService);
    close = () => app.close();
  });

  afterAll(async () => {
    await close();
  });

  async function setup() {
    const user = await prisma.user.create({
      data: {
        email: `bench-${Date.now()}@example.com`,
        name: 'Bench',
        passwordHash: 'unused',
      },
    });
    const board = await prisma.board.create({
      data: { name: 'Bench', ownerId: user.id },
    });
    const columnIds: string[] = [];
    for (let c = 0; c < 2; c++) {
      const column = await prisma.column.create({
        data: { boardId: board.id, name: `C${c}`, position: c },
      });
      await prisma.task.createMany({
        data: Array.from({ length: CARDS }, (_, position) => ({
          columnId: column.id,
          title: `T${position}`,
          position,
        })),
      });
      columnIds.push(column.id);
    }
    return { userId: user.id, columnIds };
  }

  async function time(run: () => Promise<unknown>) {
    for (let i = 0; i < 20; i++) await run(); // warm up
    const samples: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      const start = process.hrtime.bigint();
      await run();
      samples.push(Number(process.hrtime.bigint() - start) / 1e6);
    }
    samples.sort((a, b) => a - b);
    const at = (p: number) => samples[Math.floor((p / 100) * samples.length)];
    return { p50: at(50).toFixed(1), p95: at(95).toFixed(1) };
  }

  async function firstTask(columnId: string) {
    return prisma.task.findFirstOrThrow({
      where: { columnId, position: 0 },
      select: { id: true },
    });
  }

  it('reports p50/p95 in ms', async () => {
    const { userId, columnIds } = await setup();
    const [a, b] = columnIds;

    // Top to bottom of the same column: all 30 positions are rewritten.
    const sameColumn = await time(async () => {
      const task = await firstTask(a);
      await tasks.moveTask(task.id, userId, a, CARDS - 1);
    });

    // Top of one column to the top of the other: both columns are rewritten.
    let from = a;
    let to = b;
    const crossColumn = await time(async () => {
      const task = await firstTask(from);
      await tasks.moveTask(task.id, userId, to, 0);
      [from, to] = [to, from];
    });

    console.log(
      `30-card move over ${RUNS} runs (ms): ` +
        `same column p50 ${sameColumn.p50} / p95 ${sameColumn.p95}, ` +
        `cross column p50 ${crossColumn.p50} / p95 ${crossColumn.p95}`,
    );
  }, 120000);
});
