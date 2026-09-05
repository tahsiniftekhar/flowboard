import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('Task movement', () => {
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

  async function register(prefix: string) {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: prefix,
        email: `${prefix.toLowerCase().replaceAll(' ', '-')}-${Date.now()}@example.com`,
        password: 'StrongPass123!',
      })
      .expect(201);
    return response.body;
  }

  async function createBoard(token: string, name: string) {
    const response = await request(app.getHttpServer())
      .post('/boards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name })
      .expect(201);
    return response.body;
  }

  async function createColumn(token: string, boardId: string, name: string) {
    const response = await request(app.getHttpServer())
      .post(`/boards/${boardId}/columns`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name })
      .expect(201);
    return response.body;
  }

  async function createTask(token: string, columnId: string, title: string) {
    const response = await request(app.getHttpServer())
      .post(`/columns/${columnId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title })
      .expect(201);
    return response.body;
  }

  async function positions(columnId: string) {
    const tasks = await prisma.task.findMany({
      where: { columnId },
      orderBy: { position: 'asc' },
      select: { title: true, position: true },
    });
    return tasks;
  }

  function move(
    token: string,
    taskId: string,
    destinationColumnId: string,
    destinationIndex: number,
  ) {
    return request(app.getHttpServer())
      .patch(`/tasks/${taskId}/move`)
      .set('Authorization', `Bearer ${token}`)
      .send({ destinationColumnId, destinationIndex });
  }

  it('handles forward, backward, same-index, first, last, and middle moves', async () => {
    const user = await register('Movement Same Column');
    const board = await createBoard(user.accessToken, 'Same Column Board');
    const column = await createColumn(user.accessToken, board.id, 'Todo');
    const tasks = [];
    for (const title of ['A', 'B', 'C', 'D']) {
      tasks.push(await createTask(user.accessToken, column.id, title));
    }

    await move(user.accessToken, tasks[3].id, column.id, 1).expect(200);
    expect(await positions(column.id)).toEqual([
      { title: 'A', position: 0 },
      { title: 'D', position: 1 },
      { title: 'B', position: 2 },
      { title: 'C', position: 3 },
    ]);

    await move(user.accessToken, tasks[0].id, column.id, 3).expect(200);
    expect(await positions(column.id)).toEqual([
      { title: 'D', position: 0 },
      { title: 'B', position: 1 },
      { title: 'C', position: 2 },
      { title: 'A', position: 3 },
    ]);

    await move(user.accessToken, tasks[0].id, column.id, 3).expect(200);
    await move(user.accessToken, tasks[2].id, column.id, 1).expect(200);
    expect(await positions(column.id)).toEqual([
      { title: 'D', position: 0 },
      { title: 'C', position: 1 },
      { title: 'B', position: 2 },
      { title: 'A', position: 3 },
    ]);
  });

  it('moves across columns, including empty and out-of-bounds destinations', async () => {
    const user = await register('Movement Cross Column');
    const board = await createBoard(user.accessToken, 'Cross Column Board');
    const source = await createColumn(user.accessToken, board.id, 'Todo');
    const destination = await createColumn(user.accessToken, board.id, 'Doing');
    const empty = await createColumn(user.accessToken, board.id, 'Empty');
    const sourceTasks = [];
    for (const title of ['A', 'B', 'C']) {
      sourceTasks.push(await createTask(user.accessToken, source.id, title));
    }
    for (const title of ['D', 'E']) {
      await createTask(user.accessToken, destination.id, title);
    }

    await move(user.accessToken, sourceTasks[2].id, destination.id, 1).expect(
      200,
    );
    expect(await positions(source.id)).toEqual([
      { title: 'A', position: 0 },
      { title: 'B', position: 1 },
    ]);
    expect(await positions(destination.id)).toEqual([
      { title: 'D', position: 0 },
      { title: 'C', position: 1 },
      { title: 'E', position: 2 },
    ]);

    await move(user.accessToken, sourceTasks[0].id, empty.id, 99).expect(200);
    expect(await positions(empty.id)).toEqual([{ title: 'A', position: 0 }]);
    expect(await positions(source.id)).toEqual([{ title: 'B', position: 0 }]);
  });

  it('rejects unauthorized and cross-board movement without changing positions', async () => {
    const owner = await register('Movement Owner');
    const outsider = await register('Movement Outsider');
    const ownerBoard = await createBoard(owner.accessToken, 'Owner Board');
    const ownerColumn = await createColumn(
      owner.accessToken,
      ownerBoard.id,
      'Todo',
    );
    const task = await createTask(
      owner.accessToken,
      ownerColumn.id,
      'Protected task',
    );
    const outsiderBoard = await createBoard(
      outsider.accessToken,
      'Outsider Board',
    );
    const outsiderColumn = await createColumn(
      outsider.accessToken,
      outsiderBoard.id,
      'Todo',
    );

    await move(outsider.accessToken, task.id, ownerColumn.id, 0).expect(403);
    await move(owner.accessToken, task.id, outsiderColumn.id, 0).expect(403);
    await move(
      owner.accessToken,
      task.id,
      '00000000-0000-0000-0000-000000000000',
      0,
    ).expect(404);

    expect(await positions(ownerColumn.id)).toEqual([
      { title: 'Protected task', position: 0 },
    ]);
  });
});
