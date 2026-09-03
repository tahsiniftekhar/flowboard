import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';

describe('Auth', () => {
  let app: INestApplication;

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
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a new user', async () => {
    const email = `alice-${Date.now()}@example.com`;

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Alice Example',
        email,
        password: 'StrongPass123!',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      user: {
        email,
        name: 'Alice Example',
      },
    });
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.body.accessToken).toBeTruthy();
  });

  it('rejects duplicate email registration', async () => {
    const email = `bob-${Date.now()}@example.com`;

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Bob Example',
        email,
        password: 'StrongPass123!',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Bob Duplicate',
        email,
        password: 'AnotherStrongPass123!',
      })
      .expect(409);
  });

  it('logs in with valid credentials', async () => {
    const email = `charlie-${Date.now()}@example.com`;

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Charlie Example',
        email,
        password: 'StrongPass123!',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password: 'StrongPass123!',
      })
      .expect(200);

    expect(response.body.accessToken).toBeTruthy();
    expect(response.body.user.email).toBe(email);
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it('rejects invalid password', async () => {
    const email = `diana-${Date.now()}@example.com`;

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Diana Example',
        email,
        password: 'StrongPass123!',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password: 'WrongPassword123!',
      })
      .expect(401);
  });

  it('rejects nonexistent user login', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: `ghost-${Date.now()}@example.com`,
        password: 'StrongPass123!',
      })
      .expect(401);
  });

  it('requires a token for /auth/me', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('rejects invalid token for /auth/me', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('returns current user with valid token', async () => {
    const email = `erin-${Date.now()}@example.com`;

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Erin Example',
        email,
        password: 'StrongPass123!',
      })
      .expect(201);

    const token = registerResponse.body.accessToken;

    const meResponse = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(meResponse.body.email).toBe(email);
    expect(meResponse.body.name).toBe('Erin Example');
    expect(meResponse.body.passwordHash).toBeUndefined();
  });
});
