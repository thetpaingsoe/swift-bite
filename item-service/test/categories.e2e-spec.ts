import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import request from 'supertest';
import { App } from 'supertest/types';
import { ItemsModule } from '../src/items/items.module';
import { DbService } from '../src/db/db.service';
import { categories, menuItems } from '../src/db/schema';

const mockHttpService = {
  get: jest
    .fn()
    .mockReturnValue(
      of({ data: { userId: 'test-user-id', email: 'test@example.com' } }),
    ),
};

describe('Categories (e2e)', () => {
  let app: INestApplication<App>;
  let dbService: DbService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ItemsModule],
    })
      .overrideProvider(HttpService)
      .useValue(mockHttpService)
      .compile();

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
    await dbService.db.delete(menuItems);
    await dbService.db.delete(categories);
  });

  describe('GET /categories', () => {
    it('should return empty array when no categories exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/categories')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return all categories', async () => {
      await dbService.db
        .insert(categories)
        .values([{ name: 'Cat-A' }, { name: 'Cat-B' }]);

      const response = await request(app.getHttpServer())
        .get('/categories')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe('Cat-A');
      expect(response.body[1].name).toBe('Cat-B');
    });
  });

  describe('POST /categories', () => {
    it('should create a category', async () => {
      const response = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', 'Bearer test-token')
        .send({ name: 'Cat-A' })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Cat-A');
    });

    it('should reject duplicate category name', async () => {
      await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', 'Bearer test-token')
        .send({ name: 'Cat-A' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', 'Bearer test-token')
        .send({ name: 'Cat-A' })
        .expect(409);
    });

    it('should reject missing name', async () => {
      await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', 'Bearer test-token')
        .send({})
        .expect(400);
    });
  });

  describe('PATCH /categories/:id', () => {
    it('should update a category', async () => {
      const [created] = await dbService.db
        .insert(categories)
        .values({ name: 'Cat-A' })
        .returning();

      const response = await request(app.getHttpServer())
        .patch(`/categories/${created.id}`)
        .set('Authorization', 'Bearer test-token')
        .send({ name: 'Main Course' })
        .expect(200);

      expect(response.body.name).toBe('Main Course');
    });

    it('should reject non-UUID id', async () => {
      await request(app.getHttpServer())
        .patch('/categories/not-a-uuid')
        .set('Authorization', 'Bearer test-token')
        .send({ name: 'Cat-A' })
        .expect(400);
    });

    it('should return 404 for non-existent category', async () => {
      await request(app.getHttpServer())
        .patch('/categories/00000000-0000-0000-0000-000000000000')
        .set('Authorization', 'Bearer test-token')
        .send({ name: 'Cat-A' })
        .expect(404);
    });
  });

  describe('DELETE /categories/:id', () => {
    it('should delete a category', async () => {
      const [created] = await dbService.db
        .insert(categories)
        .values({ name: 'Cat-A' })
        .returning();

      await request(app.getHttpServer())
        .delete(`/categories/${created.id}`)
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      const remaining = await dbService.db.select().from(categories);
      expect(remaining).toHaveLength(0);
    });

    it('should cascade delete menu items', async () => {
      const [category] = await dbService.db
        .insert(categories)
        .values({ name: 'Cat-A' })
        .returning();

      await dbService.db.insert(menuItems).values({
        name: 'Pizza',
        description: 'Cheesy pizza',
        price: 1299,
        categoryId: category.id,
        imageUrl: 'https://example.com/pizza.jpg',
      });

      await request(app.getHttpServer())
        .delete(`/categories/${category.id}`)
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      const remainingItems = await dbService.db.select().from(menuItems);
      expect(remainingItems).toHaveLength(0);
    });
  });
});
