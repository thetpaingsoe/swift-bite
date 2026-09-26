import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/auth/auth.module';
import { DbService } from '../src/db/db.service';
import { addresses, users } from '../src/db/schema';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let dbService: DbService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    dbService = app.get(DbService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dbService.db.delete(addresses);
    await dbService.db.delete(users);
  });

  describe('POST /auth/register', () => {
    it('should register a new user and return token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'Password1!',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('John Doe');
      expect(response.body.email).toBe('john@example.com');
      expect(response.body.role).toBe('customer');
      expect(response.body).toHaveProperty('token');
    });

    it('should reject duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'Password1!',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'John Again',
          email: 'john@example.com',
          password: 'Password456!',
        })
        .expect(409);
    });

    it('should reject invalid email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'John Doe',
          email: 'not-an-email',
          password: 'Password1!',
        })
        .expect(400);
    });

    it('should reject short password (less than 8 chars)', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'Ab1!',
        })
        .expect(400);
    });

    it('should reject password without uppercase', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'lowercase1!',
        })
        .expect(400);
    });

    it('should reject password without number', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'NoNumber!',
        })
        .expect(400);
    });

    it('should reject password without special character', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'NoSpecial1',
        })
        .expect(400);
    });

    it('should reject missing fields', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'John Doe',
        })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await request(app.getHttpServer()).post('/auth/register').send({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password1!',
      });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'john@example.com',
          password: 'Password1!',
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe('John Doe');
      expect(response.body.email).toBe('john@example.com');
      expect(response.body.role).toBe('customer');
      expect(response.body.token).toBeDefined();
    });

    it('should reject wrong password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'john@example.com',
          password: 'WrongPass1!',
        })
        .expect(401);
    });

    it('should reject non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nobody@example.com',
          password: 'Password1!',
        })
        .expect(401);
    });
  });

  describe('GET /auth/verify', () => {
    let token: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'Password1!',
        });
      token = response.body.token;
    });

    it('should verify valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/verify')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('userId');
      expect(response.body).toHaveProperty('email', 'john@example.com');
      expect(response.body).toHaveProperty('role', 'customer');
    });

    it('should reject missing token', async () => {
      await request(app.getHttpServer()).get('/auth/verify').expect(401);
    });

    it('should reject invalid token', async () => {
      await request(app.getHttpServer())
        .get('/auth/verify')
        .set('Authorization', 'Bearer invalid-token-here')
        .expect(401);
    });

    it('should reject token without Bearer prefix', async () => {
      await request(app.getHttpServer())
        .get('/auth/verify')
        .set('Authorization', token)
        .expect(401);
    });
  });

  describe('PATCH /auth/profile', () => {
    let token: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'Password1!',
        });
      token = (response.body as { token: string }).token;
    });

    it('should update my display name', async () => {
      const response = await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Johnny' })
        .expect(200);

      const body = response.body as { name: string; email: string };
      expect(body.name).toBe('Johnny');
      expect(body.email).toBe('john@example.com');
    });

    it('should update my phone', async () => {
      const response = await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'John Doe', phone: '+959123456789' })
        .expect(200);

      expect((response.body as { phone: string }).phone).toBe('+959123456789');
    });

    it('should keep my phone on a name-only update', async () => {
      await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'John Doe', phone: '+959123456789' })
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Johnny' })
        .expect(200);

      const body = response.body as { name: string; phone: string };
      expect(body.name).toBe('Johnny');
      expect(body.phone).toBe('+959123456789');
    });

    it('should reject short phone', async () => {
      await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'John Doe', phone: '123' })
        .expect(400);
    });

    it('should reject missing token', async () => {
      await request(app.getHttpServer())
        .patch('/auth/profile')
        .send({ name: 'Johnny' })
        .expect(401);
    });

    it('should reject invalid token', async () => {
      await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', 'Bearer invalid-token-here')
        .send({ name: 'Johnny' })
        .expect(401);
    });

    it('should reject too-short name', async () => {
      await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'J' })
        .expect(400);
    });
  });

  describe('PATCH /auth/password', () => {
    let token: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'Password1!',
        });
      token = (response.body as { token: string }).token;
    });

    it('should change password and allow login with the new one', async () => {
      await request(app.getHttpServer())
        .patch('/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'Password1!', newPassword: 'NewPass2@' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'john@example.com', password: 'NewPass2@' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'john@example.com', password: 'Password1!' })
        .expect(401);
    });

    it('should reject wrong current password', async () => {
      await request(app.getHttpServer())
        .patch('/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'WrongPass1!', newPassword: 'NewPass2@' })
        .expect(401);
    });

    it('should reject weak new password', async () => {
      await request(app.getHttpServer())
        .patch('/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'Password1!', newPassword: 'weak' })
        .expect(400);
    });

    it('should reject missing token', async () => {
      await request(app.getHttpServer())
        .patch('/auth/password')
        .send({ currentPassword: 'Password1!', newPassword: 'NewPass2@' })
        .expect(401);
    });
  });

  describe('/addresses', () => {
    let token: string;

    const home = {
      label: 'Home',
      street: '123 Main St',
      area: 'Downtown',
    };

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'Password1!',
        });
      token = (response.body as { token: string }).token;
    });

    it('should save and list my addresses', async () => {
      await request(app.getHttpServer())
        .post('/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send(home)
        .expect(201);

      const list = await request(app.getHttpServer())
        .get('/addresses')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const rows = list.body as { label: string; street: string }[];
      expect(rows).toHaveLength(1);
      expect(rows[0].label).toBe('Home');
      expect(rows[0].street).toBe('123 Main St');
    });

    it('should reject address without label', async () => {
      await request(app.getHttpServer())
        .post('/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send({
          street: '123 Main St',
          area: 'Downtown',
        })
        .expect(400);
    });

    it('should reject unauthenticated list', async () => {
      await request(app.getHttpServer()).get('/addresses').expect(401);
    });

    it('should update my address', async () => {
      const created = await request(app.getHttpServer())
        .post('/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send(home)
        .expect(201);

      const id = (created.body as { id: string }).id;
      const updated = await request(app.getHttpServer())
        .patch(`/addresses/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ label: 'Work' })
        .expect(200);

      expect((updated.body as { label: string }).label).toBe('Work');
    });

    it('should not touch another user address', async () => {
      const created = await request(app.getHttpServer())
        .post('/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send(home)
        .expect(201);
      const id = (created.body as { id: string }).id;

      const other = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com',
          password: 'Password1!',
        });
      const otherToken = (other.body as { token: string }).token;

      await request(app.getHttpServer())
        .patch(`/addresses/${id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ label: 'Stolen' })
        .expect(404);

      await request(app.getHttpServer())
        .delete(`/addresses/${id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);
    });

    it('should delete my address', async () => {
      const created = await request(app.getHttpServer())
        .post('/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send(home)
        .expect(201);
      const id = (created.body as { id: string }).id;

      await request(app.getHttpServer())
        .delete(`/addresses/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const list = await request(app.getHttpServer())
        .get('/addresses')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(list.body as unknown[]).toHaveLength(0);
    });
  });
});
