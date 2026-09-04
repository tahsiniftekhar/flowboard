import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Boards', () => {
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

  it('creates a board and stores the owner membership', async () => {
    const email = `owner-${Date.now()}@example.com`;

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Owner One',
        email,
        password: 'StrongPass123!',
      })
      .expect(201);

    const token = registerResponse.body.accessToken;

    const createResponse = await request(app.getHttpServer())
      .post('/boards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alpha Board' })
      .expect(201);

    expect(createResponse.body.name).toBe('Alpha Board');
    expect(createResponse.body.ownerId).toBeTruthy();

    const board = await prisma.board.findUnique({
      where: { id: createResponse.body.id },
      include: { members: true },
    });

    expect(board).toBeTruthy();
    expect(board?.members).toHaveLength(1);
    expect(board?.members[0].role).toBe('OWNER');
  });

  it('lists only boards accessible to the authenticated user', async () => {
    const ownerEmail = `owner-list-${Date.now()}@example.com`;
    const secondEmail = `member-list-${Date.now()}@example.com`;

    const ownerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Owner List',
        email: ownerEmail,
        password: 'StrongPass123!',
      })
      .expect(201);

    const memberResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Member List',
        email: secondEmail,
        password: 'StrongPass123!',
      })
      .expect(201);

    const ownerToken = ownerResponse.body.accessToken;
    const memberToken = memberResponse.body.accessToken;

    await request(app.getHttpServer())
      .post('/boards')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Private Board' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/boards')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Another Private Board' })
      .expect(201);

    const listResponse = await request(app.getHttpServer())
      .get('/boards')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(listResponse.body).toEqual([]);

    const ownerListResponse = await request(app.getHttpServer())
      .get('/boards')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(ownerListResponse.body.length).toBeGreaterThanOrEqual(2);
  });

  it('retrieves, updates, and deletes a board only for authorized owners', async () => {
    const ownerEmail = `owner-edit-${Date.now()}@example.com`;
    const otherEmail = `other-edit-${Date.now()}@example.com`;

    const ownerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Owner Edit',
        email: ownerEmail,
        password: 'StrongPass123!',
      })
      .expect(201);

    const otherResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Other User',
        email: otherEmail,
        password: 'StrongPass123!',
      })
      .expect(201);

    const ownerToken = ownerResponse.body.accessToken;
    const otherToken = otherResponse.body.accessToken;

    const createResponse = await request(app.getHttpServer())
      .post('/boards')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Edit Board' })
      .expect(201);

    const boardId = createResponse.body.id;

    await request(app.getHttpServer())
      .get(`/boards/${boardId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);

    const updateResponse = await request(app.getHttpServer())
      .patch(`/boards/${boardId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Updated Board Name' })
      .expect(200);

    expect(updateResponse.body.name).toBe('Updated Board Name');

    const board = await prisma.board.findUnique({ where: { id: boardId } });
    expect(board?.name).toBe('Updated Board Name');

    await request(app.getHttpServer())
      .delete(`/boards/${boardId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/boards/${boardId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const deletedBoard = await prisma.board.findUnique({
      where: { id: boardId },
    });
    expect(deletedBoard).toBeNull();
  });

  it('allows board members to access shared boards', async () => {
    const ownerEmail = `owner-share-${Date.now()}@example.com`;
    const memberEmail = `member-share-${Date.now()}@example.com`;

    const ownerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Owner Share',
        email: ownerEmail,
        password: 'StrongPass123!',
      })
      .expect(201);

    const memberResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Member Share',
        email: memberEmail,
        password: 'StrongPass123!',
      })
      .expect(201);

    const ownerToken = ownerResponse.body.accessToken;
    const memberToken = memberResponse.body.accessToken;

    const boardResponse = await request(app.getHttpServer())
      .post('/boards')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Shared Board' })
      .expect(201);

    const boardId = boardResponse.body.id;

    await prisma.boardMember.create({
      data: {
        boardId,
        userId: (await prisma.user.findUnique({
          where: { email: memberEmail },
        }))!.id,
        role: 'MEMBER',
      },
    });

    const accessResponse = await request(app.getHttpServer())
      .get(`/boards/${boardId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(accessResponse.body.id).toBe(boardId);
  });
});
