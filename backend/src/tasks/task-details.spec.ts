import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('Task details', () => {
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
    return response.body as {
      accessToken: string;
      user: { id: string; email: string };
    };
  }

  async function setupBoard() {
    const owner = await register('details-owner');
    const member = await register('details-member');
    const outsider = await register('details-outsider');

    const board = await request(app.getHttpServer())
      .post('/boards')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Details Board' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/boards/${board.body.id}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: member.user.email })
      .expect(201);
    const column = await request(app.getHttpServer())
      .post(`/boards/${board.body.id}/columns`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Todo' })
      .expect(201);

    return {
      owner,
      member,
      outsider,
      boardId: board.body.id as string,
      columnId: column.body.id as string,
    };
  }

  it('creates a task with priority, due date, and a member assignee', async () => {
    const { owner, member, columnId } = await setupBoard();

    const response = await request(app.getHttpServer())
      .post(`/columns/${columnId}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        title: 'Detailed task',
        priority: 'HIGH',
        dueDate: '2026-12-01',
        assigneeId: member.user.id,
      })
      .expect(201);

    expect(response.body).toMatchObject({
      title: 'Detailed task',
      priority: 'HIGH',
      assigneeId: member.user.id,
      assignee: { id: member.user.id, email: member.user.email },
    });
    expect(response.body.dueDate).toMatch(/^2026-12-01/);
    expect(response.body.assignee.passwordHash).toBeUndefined();
  });

  it('defaults priority to MEDIUM and leaves optional fields empty', async () => {
    const { owner, columnId } = await setupBoard();

    const response = await request(app.getHttpServer())
      .post(`/columns/${columnId}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Plain task' })
      .expect(201);

    expect(response.body).toMatchObject({
      priority: 'MEDIUM',
      dueDate: null,
      assigneeId: null,
    });
  });

  it('updates fields partially and clears them with null', async () => {
    const { owner, member, columnId } = await setupBoard();
    const created = await request(app.getHttpServer())
      .post(`/columns/${columnId}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        title: 'Partial task',
        description: 'Keep me',
        dueDate: '2026-11-15',
        assigneeId: member.user.id,
      })
      .expect(201);

    const priorityOnly = await request(app.getHttpServer())
      .patch(`/tasks/${created.body.id}`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ priority: 'URGENT' })
      .expect(200);
    expect(priorityOnly.body).toMatchObject({
      title: 'Partial task',
      description: 'Keep me',
      priority: 'URGENT',
      assigneeId: member.user.id,
    });

    const cleared = await request(app.getHttpServer())
      .patch(`/tasks/${created.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ dueDate: null, assigneeId: null, description: null })
      .expect(200);
    expect(cleared.body).toMatchObject({
      title: 'Partial task',
      description: null,
      dueDate: null,
      assigneeId: null,
      assignee: null,
    });
  });

  it('rejects assignees who are not members of the board', async () => {
    const { owner, outsider, columnId } = await setupBoard();

    await request(app.getHttpServer())
      .post(`/columns/${columnId}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Bad assignee', assigneeId: outsider.user.id })
      .expect(400);

    const created = await request(app.getHttpServer())
      .post(`/columns/${columnId}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Valid task' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/tasks/${created.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ assigneeId: outsider.user.id })
      .expect(400);

    expect(
      await prisma.task.findUnique({ where: { id: created.body.id } }),
    ).toMatchObject({ assigneeId: null });
  });

  it('validates priority, due date, and title on update', async () => {
    const { owner, columnId } = await setupBoard();
    const created = await request(app.getHttpServer())
      .post(`/columns/${columnId}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Validated task' })
      .expect(201);

    for (const body of [
      { priority: 'CRITICAL' },
      { dueDate: 'next tuesday' },
      { dueDate: '2026-02-30' },
      { title: '' },
      { assigneeId: 'not-a-uuid' },
    ]) {
      await request(app.getHttpServer())
        .patch(`/tasks/${created.body.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send(body)
        .expect(400);
    }
  });

  it('blocks outsiders from editing task details', async () => {
    const { owner, outsider, columnId } = await setupBoard();
    const created = await request(app.getHttpServer())
      .post(`/columns/${columnId}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Private task' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/tasks/${created.body.id}`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .send({ assigneeId: outsider.user.id })
      .expect(403);
  });

  it('unassigns tasks when a member leaves the board', async () => {
    const { owner, member, boardId, columnId } = await setupBoard();
    const created = await request(app.getHttpServer())
      .post(`/columns/${columnId}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Assigned task', assigneeId: member.user.id })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/boards/${boardId}/members/${member.user.id}`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .expect(200);

    expect(
      await prisma.task.findUnique({ where: { id: created.body.id } }),
    ).toMatchObject({ assigneeId: null });
    await request(app.getHttpServer())
      .get(`/boards/${boardId}`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .expect(403);
  });
});
