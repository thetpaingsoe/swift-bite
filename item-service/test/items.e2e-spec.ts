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

describe('Items (e2e)', () => {
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

  describe('GET /items', () => {
    it('should return empty array when no items exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/items')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return all items', async () => {
      const [category] = await dbService.db
        .insert(categories)
        .values({ name: 'Item-Cat' })
        .returning();

      await dbService.db.insert(menuItems).values([
        {
          name: 'Pizza',
          description: 'Cheesy pizza',
          price: 1299,
          categoryId: category.id,
          imageUrl: 'https://example.com/pizza.jpg',
        },
        {
          name: 'Burger',
          description: 'Classic burger',
          price: 999,
          categoryId: category.id,
          imageUrl: 'https://example.com/burger.jpg',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/items')
        .expect(200);

      expect(response.body).toHaveLength(2);
    });

    it('should filter items by category_id', async () => {
      const [food] = await dbService.db
        .insert(categories)
        .values({ name: 'Item-Cat' })
        .returning();
      const [drinks] = await dbService.db
        .insert(categories)
        .values({ name: 'Drinks' })
        .returning();

      await dbService.db.insert(menuItems).values([
        {
          name: 'Pizza',
          description: 'Cheesy pizza',
          price: 1299,
          categoryId: food.id,
          imageUrl: 'https://example.com/pizza.jpg',
        },
        {
          name: 'Cola',
          description: 'Cold cola',
          price: 299,
          categoryId: drinks.id,
          imageUrl: 'https://example.com/cola.jpg',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get(`/items?category_id=${food.id}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Pizza');
    });
  });

  describe('GET /items/:id', () => {
    it('should return a single item', async () => {
      const [category] = await dbService.db
        .insert(categories)
        .values({ name: 'Item-Cat' })
        .returning();

      const [created] = await dbService.db
        .insert(menuItems)
        .values({
          name: 'Pizza',
          description: 'Cheesy pizza',
          price: 1299,
          categoryId: category.id,
          imageUrl: 'https://example.com/pizza.jpg',
        })
        .returning();

      const response = await request(app.getHttpServer())
        .get(`/items/${created.id}`)
        .expect(200);

      expect(response.body.name).toBe('Pizza');
      expect(response.body.price).toBe(1299);
    });

    it('should return 404 for non-existent item', async () => {
      await request(app.getHttpServer())
        .get('/items/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('POST /items', () => {
    it('should create an item', async () => {
      const [category] = await dbService.db
        .insert(categories)
        .values({ name: 'Item-Cat' })
        .returning();

      const response = await request(app.getHttpServer())
        .post('/items')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'Pizza',
          description: 'Cheesy pizza',
          price: 1299,
          categoryId: category.id,
          imageUrl: 'https://example.com/pizza.jpg',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Pizza');
      expect(response.body.price).toBe(1299);
    });

    it('should reject item with non-existent category', async () => {
      await request(app.getHttpServer())
        .post('/items')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'Pizza',
          description: 'Cheesy pizza',
          price: 1299,
          categoryId: '00000000-0000-0000-0000-000000000000',
          imageUrl: 'https://example.com/pizza.jpg',
        })
        .expect(404);
    });

    it('should reject missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/items')
        .set('Authorization', 'Bearer test-token')
        .send({ name: 'Pizza' })
        .expect(400);
    });

    it('should reject price below minimum', async () => {
      const [category] = await dbService.db
        .insert(categories)
        .values({ name: 'Item-Cat' })
        .returning();

      await request(app.getHttpServer())
        .post('/items')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'Pizza',
          description: 'Cheesy pizza',
          price: 0,
          categoryId: category.id,
          imageUrl: 'https://example.com/pizza.jpg',
        })
        .expect(400);
    });
  });

  describe('PATCH /items/:id', () => {
    it('should update an item', async () => {
      const [category] = await dbService.db
        .insert(categories)
        .values({ name: 'Item-Cat' })
        .returning();

      const [created] = await dbService.db
        .insert(menuItems)
        .values({
          name: 'Pizza',
          description: 'Cheesy pizza',
          price: 1299,
          categoryId: category.id,
          imageUrl: 'https://example.com/pizza.jpg',
        })
        .returning();

      const response = await request(app.getHttpServer())
        .patch(`/items/${created.id}`)
        .set('Authorization', 'Bearer test-token')
        .send({ name: 'Margherita Pizza', price: 1499 })
        .expect(200);

      expect(response.body.name).toBe('Margherita Pizza');
      expect(response.body.price).toBe(1499);
    });

    it('should return 404 for non-existent item', async () => {
      await request(app.getHttpServer())
        .patch('/items/00000000-0000-0000-0000-000000000000')
        .set('Authorization', 'Bearer test-token')
        .send({ name: 'Updated' })
        .expect(404);
    });
  });

  describe('DELETE /items/:id', () => {
    it('should delete an item', async () => {
      const [category] = await dbService.db
        .insert(categories)
        .values({ name: 'Item-Cat' })
        .returning();

      const [created] = await dbService.db
        .insert(menuItems)
        .values({
          name: 'Pizza',
          description: 'Cheesy pizza',
          price: 1299,
          categoryId: category.id,
          imageUrl: 'https://example.com/pizza.jpg',
        })
        .returning();

      await request(app.getHttpServer())
        .delete(`/items/${created.id}`)
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      const remaining = await dbService.db.select().from(menuItems);
      expect(remaining).toHaveLength(0);
    });

    it('should return 404 for non-existent item', async () => {
      await request(app.getHttpServer())
        .delete('/items/00000000-0000-0000-0000-000000000000')
        .set('Authorization', 'Bearer test-token')
        .expect(404);
    });
  });
});
