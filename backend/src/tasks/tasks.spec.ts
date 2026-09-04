import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Tasks', () => {
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

  it('creates, updates, and deletes tasks with append positions', async () => {
    const email = `task-owner-${Date.now()}@example.com`;
    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Task Owner', email, password: 'StrongPass123!' })
      .expect(201);
    const token = registration.body.accessToken;

    const board = await request(app.getHttpServer())
      .post('/boards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Task Board' })
      .expect(201);
    const boardId = board.body.id;

    const column = await request(app.getHttpServer())
      .post(`/boards/${boardId}/columns`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Todo' })
      .expect(201);
    const columnId = column.body.id;

    const firstTask = await request(app.getHttpServer())
      .post(`/columns/${columnId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'First task', description: 'Initial task' })
      .expect(201);
    const secondTask = await request(app.getHttpServer())
      .post(`/columns/${columnId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Second task' })
      .expect(201);

    expect(firstTask.body.position).toBe(0);
    expect(secondTask.body.position).toBe(1);
    expect(secondTask.body.description).toBeNull();

    const updateResponse = await request(app.getHttpServer())
      .patch(`/tasks/${firstTask.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated task', description: 'Updated description' })
      .expect(200);
    expect(updateResponse.body.title).toBe('Updated task');

    await request(app.getHttpServer())
      .delete(`/tasks/${firstTask.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(
      await prisma.task.findUnique({ where: { id: firstTask.body.id } }),
    ).toBeNull();
    expect(
      await prisma.task.findUnique({ where: { id: secondTask.body.id } }),
    ).toMatchObject({
      position: 0,
    });
  });

  it('rejects invalid task input and nonexistent columns', async () => {
    const email = `task-validation-${Date.now()}@example.com`;
    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Task Validation', email, password: 'StrongPass123!' })
      .expect(201);
    const token = registration.body.accessToken;

    await request(app.getHttpServer())
      .post('/columns/00000000-0000-0000-0000-000000000000/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '' })
      .expect(400);

    const board = await request(app.getHttpServer())
      .post('/boards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Validation Board' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/columns/${board.body.id}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Missing column' })
      .expect(404);
  });

  it('allows shared members and blocks users from another board', async () => {
    const ownerEmail = `task-shared-owner-${Date.now()}@example.com`;
    const memberEmail = `task-shared-member-${Date.now()}@example.com`;
    const outsiderEmail = `task-shared-outsider-${Date.now()}@example.com`;

    const owner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Shared Owner',
        email: ownerEmail,
        password: 'StrongPass123!',
      })
      .expect(201);
    const member = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Shared Member',
        email: memberEmail,
        password: 'StrongPass123!',
      })
      .expect(201);
    const outsider = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Task Outsider',
        email: outsiderEmail,
        password: 'StrongPass123!',
      })
      .expect(201);

    const board = await request(app.getHttpServer())
      .post('/boards')
      .set('Authorization', `Bearer ${owner.body.accessToken}`)
      .send({ name: 'Shared Task Board' })
      .expect(201);
    const boardId = board.body.id;

    await request(app.getHttpServer())
      .post(`/boards/${boardId}/members`)
      .set('Authorization', `Bearer ${owner.body.accessToken}`)
      .send({ email: memberEmail })
      .expect(201);

    const column = await request(app.getHttpServer())
      .post(`/boards/${boardId}/columns`)
      .set('Authorization', `Bearer ${owner.body.accessToken}`)
      .send({ name: 'Shared Todo' })
      .expect(201);

    const memberTask = await request(app.getHttpServer())
      .post(`/columns/${column.body.id}/tasks`)
      .set('Authorization', `Bearer ${member.body.accessToken}`)
      .send({ title: 'Member task' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/tasks/${memberTask.body.id}`)
      .set('Authorization', `Bearer ${outsider.body.accessToken}`)
      .send({ title: 'Unauthorized update' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/tasks/${memberTask.body.id}`)
      .set('Authorization', `Bearer ${outsider.body.accessToken}`)
      .expect(403);
  });
});
