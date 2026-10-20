import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('Column movement', () => {
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
        email: `${prefix}-${Date.now()}-${Math.random()}@example.com`,
        password: 'StrongPass123!',
      })
      .expect(201);
    return response.body.accessToken as string;
  }

  async function createBoardWithColumns(token: string, names: string[]) {
    const board = await request(app.getHttpServer())
      .post('/boards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Column Board' })
      .expect(201);
    const columns: Record<string, string> = {};
    for (const name of names) {
      const column = await request(app.getHttpServer())
        .post(`/boards/${board.body.id}/columns`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name })
        .expect(201);
      columns[name] = column.body.id;
    }
    return { boardId: board.body.id as string, columns };
  }

  async function columnOrder(boardId: string) {
    const columns = await prisma.column.findMany({
      where: { boardId },
      orderBy: { position: 'asc' },
    });
    expect(columns.map((column) => column.position)).toEqual(
      columns.map((_, index) => index),
    );
    return columns.map((column) => column.name);
  }

  function move(token: string, columnId: string, destinationIndex: number) {
    return request(app.getHttpServer())
      .patch(`/columns/${columnId}/move`)
      .set('Authorization', `Bearer ${token}`)
      .send({ destinationIndex });
  }

  it('reorders columns forward, backward, and past the end', async () => {
    const token = await register('column-mover');
    const { boardId, columns } = await createBoardWithColumns(token, [
      'A',
      'B',
      'C',
      'D',
    ]);

    await move(token, columns.A, 2).expect(200);
    expect(await columnOrder(boardId)).toEqual(['B', 'C', 'A', 'D']);

    await move(token, columns.D, 0).expect(200);
    expect(await columnOrder(boardId)).toEqual(['D', 'B', 'C', 'A']);

    const response = await move(token, columns.B, 99).expect(200);
    expect(await columnOrder(boardId)).toEqual(['D', 'C', 'A', 'B']);
    expect(response.body.map((column: { name: string }) => column.name)).toEqual(
      ['D', 'C', 'A', 'B'],
    );

    await move(token, columns.C, 1).expect(200);
    expect(await columnOrder(boardId)).toEqual(['D', 'C', 'A', 'B']);
  });

  it('keeps tasks attached to their column when it moves', async () => {
    const token = await register('column-tasks');
    const { columns } = await createBoardWithColumns(token, ['Todo', 'Done']);
    const task = await request(app.getHttpServer())
      .post(`/columns/${columns.Todo}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Stays put' })
      .expect(201);

    await move(token, columns.Todo, 1).expect(200);

    expect(
      await prisma.task.findUnique({ where: { id: task.body.id } }),
    ).toMatchObject({ columnId: columns.Todo, position: 0 });
  });

  it('validates the destination index and blocks outsiders', async () => {
    const ownerToken = await register('column-owner');
    const outsiderToken = await register('column-outsider');
    const { boardId, columns } = await createBoardWithColumns(ownerToken, [
      'A',
      'B',
    ]);

    await move(ownerToken, columns.A, -1).expect(400);
    await request(app.getHttpServer())
      .patch(`/columns/${columns.A}/move`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ destinationIndex: 'first' })
      .expect(400);
    await move(outsiderToken, columns.A, 1).expect(403);
    await move(ownerToken, '00000000-0000-0000-0000-000000000000', 0).expect(
      404,
    );

    expect(await columnOrder(boardId)).toEqual(['A', 'B']);
  });
});
