import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({ where: { email: 'e2e@test.com' } });
    await app.close();
  });

  it('POST /api/auth/register — should register a new user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'e2e@test.com', name: 'E2E User', password: 'password123' })
      .expect(201);

    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.email).toBe('e2e@test.com');

    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  it('POST /api/auth/register — should fail for duplicate email', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'e2e@test.com', name: 'E2E User', password: 'password123' })
      .expect(409);
  });

  it('POST /api/auth/login — should login successfully', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'e2e@test.com', password: 'password123' })
      .expect(200);

    expect(res.body.data.accessToken).toBeDefined();
  });

  it('POST /api/auth/login — should fail with wrong password', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'e2e@test.com', password: 'wrong-password' })
      .expect(401);
  });

  it('POST /api/auth/refresh — should refresh access token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(res.body.data.accessToken).toBeDefined();
    // Old refresh token should be revoked
    refreshToken = res.body.data.refreshToken;
  });

  it('POST /api/auth/me — should return current user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data.email).toBe('e2e@test.com');
  });

  it('GET /api/workers — should require auth', async () => {
    await request(app.getHttpServer()).get('/api/workers').expect(401);
  });
});
