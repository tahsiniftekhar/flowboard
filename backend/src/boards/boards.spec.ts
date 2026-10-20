import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

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

  it('allows only the owner to share and remove members', async () => {
    const ownerEmail = `owner-members-${Date.now()}@example.com`;
    const memberEmail = `member-members-${Date.now()}@example.com`;
    const outsiderEmail = `outsider-members-${Date.now()}@example.com`;

    const ownerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Owner Members',
        email: ownerEmail,
        password: 'StrongPass123!',
      })
      .expect(201);
    const memberResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Member Members',
        email: memberEmail,
        password: 'StrongPass123!',
      })
      .expect(201);
    const outsiderResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Outsider Members',
        email: outsiderEmail,
        password: 'StrongPass123!',
      })
      .expect(201);

    const ownerToken = ownerResponse.body.accessToken;
    const memberToken = memberResponse.body.accessToken;
    const outsiderToken = outsiderResponse.body.accessToken;
    const memberId = memberResponse.body.user.id;
    const ownerId = ownerResponse.body.user.id;

    const boardResponse = await request(app.getHttpServer())
      .post('/boards')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Membership Board' })
      .expect(201);
    const boardId = boardResponse.body.id;

    const shareResponse = await request(app.getHttpServer())
      .post(`/boards/${boardId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: memberEmail })
      .expect(201);

    expect(shareResponse.body.role).toBe('MEMBER');
    expect(shareResponse.body.user.email).toBe(memberEmail);

    await request(app.getHttpServer())
      .post(`/boards/${boardId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: memberEmail })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/boards/${boardId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: `missing-${Date.now()}@example.com` })
      .expect(404);

    const membersResponse = await request(app.getHttpServer())
      .get(`/boards/${boardId}/members`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(membersResponse.body).toHaveLength(2);
    expect(
      membersResponse.body.every(
        (entry: { user: { passwordHash?: string } }) =>
          entry.user.passwordHash === undefined,
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .post(`/boards/${boardId}/members`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ email: outsiderEmail })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/boards/${boardId}/members/${ownerId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/boards/${boardId}/members/${memberId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/boards/${boardId}/members/${memberId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/boards/${boardId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });

  it('prevents membership operations across boards', async () => {
    const firstOwnerEmail = `owner-first-${Date.now()}@example.com`;
    const secondOwnerEmail = `owner-second-${Date.now()}@example.com`;
    const memberEmail = `member-cross-${Date.now()}@example.com`;

    const firstOwnerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'First Owner',
        email: firstOwnerEmail,
        password: 'StrongPass123!',
      })
      .expect(201);
    const secondOwnerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Second Owner',
        email: secondOwnerEmail,
        password: 'StrongPass123!',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Cross Member',
        email: memberEmail,
        password: 'StrongPass123!',
      })
      .expect(201);

    const firstOwnerToken = firstOwnerResponse.body.accessToken;
    const secondOwnerToken = secondOwnerResponse.body.accessToken;

    const firstBoardResponse = await request(app.getHttpServer())
      .post('/boards')
      .set('Authorization', `Bearer ${firstOwnerToken}`)
      .send({ name: 'First Board' })
      .expect(201);
    const secondBoardResponse = await request(app.getHttpServer())
      .post('/boards')
      .set('Authorization', `Bearer ${secondOwnerToken}`)
      .send({ name: 'Second Board' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/boards/${secondBoardResponse.body.id}/members`)
      .set('Authorization', `Bearer ${firstOwnerToken}`)
      .send({ email: memberEmail })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/boards/${firstBoardResponse.body.id}/members`)
      .set('Authorization', `Bearer ${secondOwnerToken}`)
      .expect(403);
  });

  it('lists boards with role and content counts', async () => {
    const owner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Count Owner',
        email: `count-owner-${Date.now()}@example.com`,
        password: 'StrongPass123!',
      })
      .expect(201);
    const member = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Count Member',
        email: `count-member-${Date.now()}@example.com`,
        password: 'StrongPass123!',
      })
      .expect(201);
    const ownerToken = owner.body.accessToken;

    const board = await request(app.getHttpServer())
      .post('/boards')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Counted Board' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/boards/${board.body.id}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: member.body.user.email })
      .expect(201);
    for (const name of ['Todo', 'Done']) {
      const column = await request(app.getHttpServer())
        .post(`/boards/${board.body.id}/columns`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/columns/${column.body.id}/tasks`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: `${name} task` })
        .expect(201);
    }

    const ownerList = await request(app.getHttpServer())
      .get('/boards')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(ownerList.body[0]).toMatchObject({
      id: board.body.id,
      role: 'OWNER',
      memberCount: 2,
      columnCount: 2,
      taskCount: 2,
      owner: { name: 'Count Owner' },
    });

    const memberList = await request(app.getHttpServer())
      .get('/boards')
      .set('Authorization', `Bearer ${member.body.accessToken}`)
      .expect(200);
    expect(memberList.body[0]).toMatchObject({
      id: board.body.id,
      role: 'MEMBER',
    });
  });

  it('lets members leave a board but not the owner', async () => {
    const owner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Leave Owner',
        email: `leave-owner-${Date.now()}@example.com`,
        password: 'StrongPass123!',
      })
      .expect(201);
    const member = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Leave Member',
        email: `leave-member-${Date.now()}@example.com`,
        password: 'StrongPass123!',
      })
      .expect(201);
    const other = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Other Member',
        email: `leave-other-${Date.now()}@example.com`,
        password: 'StrongPass123!',
      })
      .expect(201);

    const board = await request(app.getHttpServer())
      .post('/boards')
      .set('Authorization', `Bearer ${owner.body.accessToken}`)
      .send({ name: 'Leavable Board' })
      .expect(201);
    for (const user of [member, other]) {
      await request(app.getHttpServer())
        .post(`/boards/${board.body.id}/members`)
        .set('Authorization', `Bearer ${owner.body.accessToken}`)
        .send({ email: user.body.user.email })
        .expect(201);
    }

    // A member cannot remove someone else.
    await request(app.getHttpServer())
      .delete(`/boards/${board.body.id}/members/${other.body.user.id}`)
      .set('Authorization', `Bearer ${member.body.accessToken}`)
      .expect(403);

    // The owner cannot leave their own board.
    await request(app.getHttpServer())
      .delete(`/boards/${board.body.id}/members/${owner.body.user.id}`)
      .set('Authorization', `Bearer ${owner.body.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/boards/${board.body.id}/members/${member.body.user.id}`)
      .set('Authorization', `Bearer ${member.body.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/boards/${board.body.id}`)
      .set('Authorization', `Bearer ${member.body.accessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/boards/${board.body.id}`)
      .set('Authorization', `Bearer ${other.body.accessToken}`)
      .expect(200);
  });
});
