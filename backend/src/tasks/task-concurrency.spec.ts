import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

// Two people dragging cards on the same board at the same moment. Every move
// rewrites positions for a whole column, so without row locks these requests
// race on the (columnId, position) unique constraint or strand a task at a
// temporary offset.
describe('Concurrent task movement', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    prisma = moduleRef.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  function api() {
    return request(app.getHttpServer());
  }

  async function register(name: string) {
    const email = `${name.toLowerCase()}-${Date.now()}@example.com`;
    const response = await api()
      .post('/auth/register')
      .send({ name, email, password: 'StrongPass123!' })
      .expect(201);
    return { token: response.body.accessToken as string, email };
  }

  async function setupSharedBoard() {
    const owner = await register('RaceOwner');
    const member = await register('RaceMember');
    const board = await api()
      .post('/boards')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Race Board' })
      .expect(201);
    await api()
      .post(`/boards/${board.body.id}/members`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: member.email })
      .expect(201);

    const columns: string[] = [];
    for (const name of ['Todo', 'Doing']) {
      const column = await api()
        .post(`/boards/${board.body.id}/columns`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ name })
        .expect(201);
      columns.push(column.body.id);
    }

    const tasks: { id: string; columnId: string }[] = [];
    for (const columnId of columns) {
      for (let i = 0; i < 6; i++) {
        const task = await api()
          .post(`/columns/${columnId}/tasks`)
          .set('Authorization', `Bearer ${owner.token}`)
          .send({ title: `T${tasks.length}` })
          .expect(201);
        tasks.push({ id: task.body.id, columnId });
      }
    }

    return { owner, member, columns, tasks };
  }

  function move(
    token: string,
    taskId: string,
    columnId: string,
    index: number,
  ) {
    return api()
      .patch(`/tasks/${taskId}/move`)
      .set('Authorization', `Bearer ${token}`)
      .send({ destinationColumnId: columnId, destinationIndex: index });
  }

  async function expectContiguous(columnIds: string[], total: number) {
    let seen = 0;
    for (const columnId of columnIds) {
      const rows = await prisma.task.findMany({
        where: { columnId },
        orderBy: { position: 'asc' },
        select: { position: true },
      });
      expect(rows.map((row) => row.position)).toEqual(
        rows.map((_, index) => index),
      );
      seen += rows.length;
    }
    expect(seen).toBe(total);
  }

  it('keeps one column contiguous when two users reorder it at once', async () => {
    const { owner, member, columns, tasks } = await setupSharedBoard();
    const todo = tasks.filter((task) => task.columnId === columns[0]);

    const responses = await Promise.all([
      move(owner.token, todo[0].id, columns[0], 5),
      move(member.token, todo[5].id, columns[0], 0),
      move(owner.token, todo[2].id, columns[0], 4),
      move(member.token, todo[3].id, columns[0], 1),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200, 200,
    ]);
    await expectContiguous(columns, tasks.length);
  });

  it('keeps both columns contiguous under crossing moves in both directions', async () => {
    const { owner, member, columns, tasks } = await setupSharedBoard();
    const [todo, doing] = columns;
    const inTodo = tasks.filter((task) => task.columnId === todo);
    const inDoing = tasks.filter((task) => task.columnId === doing);

    // Opposite lock orders (todo->doing and doing->todo) at the same time:
    // this is the deadlock case the sorted lock order exists for.
    const responses = await Promise.all([
      move(owner.token, inTodo[0].id, doing, 0),
      move(member.token, inDoing[0].id, todo, 0),
      move(owner.token, inTodo[1].id, doing, 3),
      move(member.token, inDoing[1].id, todo, 2),
      move(owner.token, inTodo[2].id, todo, 5),
      move(member.token, inDoing[2].id, doing, 0),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200, 200, 200, 200,
    ]);
    await expectContiguous(columns, tasks.length);
  });

  it('rejects the stale one of two moves of the same card with 409', async () => {
    const { owner, member, columns, tasks } = await setupSharedBoard();
    const [todo, doing] = columns;
    const card = tasks.find((task) => task.columnId === todo)!;

    // Hold both column locks so the two requests finish their unlocked
    // pre-read (card is in Todo) and then queue on the lock. Whichever gets
    // the lock first moves the card; the other must notice it is stale.
    let pending!: Promise<request.Response[]>;
    await prisma.$transaction(
      async (transaction) => {
        for (const id of [...columns].sort()) {
          await transaction.$queryRaw`SELECT id FROM "Column" WHERE id = ${id}::uuid FOR UPDATE`;
        }
        pending = Promise.all([
          move(owner.token, card.id, doing, 0),
          move(member.token, card.id, doing, 3),
        ]);
        await waitForLockWaiters(2);
      },
      { timeout: 10000 },
    );
    // Commit released the locks; the queued requests run now.
    const responses = await pending;

    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([200, 409]);
    await expectContiguous(columns, tasks.length);

    const moved = await prisma.task.findUniqueOrThrow({
      where: { id: card.id },
    });
    const winner = responses.find((response) => response.status === 200)!;
    expect(moved.columnId).toBe(doing);
    expect(moved.position).toBe(winner.body.position);
  });

  /**
   * Waits until `count` backends are blocked on a lock. Gives up after 3s so
   * that, with the locks removed, the test fails on its assertions instead
   * of hanging.
   */
  async function waitForLockWaiters(count: number) {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const [{ waiting }] = await prisma.$queryRaw<{ waiting: number }[]>`
        SELECT count(*)::int AS waiting FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'`;
      if (waiting >= count) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  it('keeps column order contiguous when two users reorder columns at once', async () => {
    const { owner, member, columns } = await setupSharedBoard();
    const board = await prisma.column.findUniqueOrThrow({
      where: { id: columns[0] },
      select: { boardId: true },
    });
    for (const name of ['Review', 'Done']) {
      await api()
        .post(`/boards/${board.boardId}/columns`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ name })
        .expect(201);
    }
    const all = await prisma.column.findMany({
      where: { boardId: board.boardId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });

    const moveColumn = (token: string, id: string, index: number) =>
      api()
        .patch(`/columns/${id}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({ destinationIndex: index });
    const responses = await Promise.all([
      moveColumn(owner.token, all[0].id, 3),
      moveColumn(member.token, all[3].id, 0),
      moveColumn(owner.token, all[1].id, 2),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200,
    ]);
    const after = await prisma.column.findMany({
      where: { boardId: board.boardId },
      orderBy: { position: 'asc' },
      select: { position: true },
    });
    expect(after.map((column) => column.position)).toEqual([0, 1, 2, 3]);
  });
});
