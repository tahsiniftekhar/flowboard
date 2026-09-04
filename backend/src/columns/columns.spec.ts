import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Columns', () => {
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

  it('creates, updates, and deletes ordered columns with their tasks', async () => {
    const ownerEmail = `column-owner-${Date.now()}@example.com`;
    const ownerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Column Owner',
        email: ownerEmail,
        password: 'StrongPass123!',
      })
      .expect(201);
    const token = ownerResponse.body.accessToken;

    const boardResponse = await request(app.getHttpServer())
      .post('/boards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Column Board' })
      .expect(201);
    const boardId = boardResponse.body.id;

    const firstResponse = await request(app.getHttpServer())
      .post(`/boards/${boardId}/columns`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Backlog' })
      .expect(201);
    const secondResponse = await request(app.getHttpServer())
      .post(`/boards/${boardId}/columns`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'In Progress' })
      .expect(201);
    const thirdResponse = await request(app.getHttpServer())
      .post(`/boards/${boardId}/columns`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Done' })
      .expect(201);

    expect(firstResponse.body.position).toBe(0);
    expect(secondResponse.body.position).toBe(1);
    expect(thirdResponse.body.position).toBe(2);

    const updateResponse = await request(app.getHttpServer())
      .patch(`/columns/${secondResponse.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Doing' })
      .expect(200);
    expect(updateResponse.body.name).toBe('Doing');

    const task = await prisma.task.create({
      data: {
        columnId: secondResponse.body.id,
        title: 'Task in deleted column',
        position: 0,
      },
    });

    await request(app.getHttpServer())
      .delete(`/columns/${secondResponse.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const remainingColumns = await prisma.column.findMany({
      where: { boardId },
      orderBy: { position: 'asc' },
    });
    expect(remainingColumns.map((column) => column.position)).toEqual([0, 1]);
    expect(remainingColumns.map((column) => column.name)).toEqual([
      'Backlog',
      'Done',
    ]);
    expect(await prisma.task.findUnique({ where: { id: task.id } })).toBeNull();
  });

  it('allows members to manage columns but blocks another board', async () => {
    const ownerEmail = `column-owner-access-${Date.now()}@example.com`;
    const memberEmail = `column-member-access-${Date.now()}@example.com`;
    const outsiderEmail = `column-outsider-access-${Date.now()}@example.com`;

    const ownerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Column Owner Access',
        email: ownerEmail,
        password: 'StrongPass123!',
      })
      .expect(201);
    const memberResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Column Member Access',
        email: memberEmail,
        password: 'StrongPass123!',
      })
      .expect(201);
    const outsiderResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Column Outsider Access',
        email: outsiderEmail,
        password: 'StrongPass123!',
      })
      .expect(201);

    const ownerToken = ownerResponse.body.accessToken;
    const memberToken = memberResponse.body.accessToken;
    const outsiderToken = outsiderResponse.body.accessToken;
    const memberId = memberResponse.body.user.id;

    const boardResponse = await request(app.getHttpServer())
      .post('/boards')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Shared Column Board' })
      .expect(201);
    const boardId = boardResponse.body.id;

    await request(app.getHttpServer())
      .post(`/boards/${boardId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: memberEmail })
      .expect(201);

    const memberColumnResponse = await request(app.getHttpServer())
      .post(`/boards/${boardId}/columns`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Member Column' })
      .expect(201);
    expect(memberColumnResponse.body.position).toBe(0);

    await request(app.getHttpServer())
      .post(`/boards/${boardId}/columns`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ name: 'Unauthorized Column' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/columns/${memberColumnResponse.body.id}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ name: 'Unauthorized Update' })
      .expect(403);

    const otherBoardResponse = await request(app.getHttpServer())
      .post('/boards')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ name: 'Other Board' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/columns/${memberColumnResponse.body.id}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/boards/${otherBoardResponse.body.id}/columns`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Cross Board Column' })
      .expect(403);

    const membership = await prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: memberId } },
    });
    expect(membership).toBeTruthy();
  });
});
