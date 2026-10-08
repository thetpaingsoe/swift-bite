import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { eq } from 'drizzle-orm';
import { OrdersModule } from '../src/orders/orders.module';
import { DbService } from '../src/db/db.service';
import { orders } from '../src/db/schema';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

describe('Orders (e2e)', () => {
  let app: INestApplication<App>;
  let dbService: DbService;
  let mockHttpService: { get: jest.Mock };

  const mockItem = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Pizza',
    price: 1299,
  };

  beforeAll(async () => {
    mockHttpService = {
      get: jest.fn().mockReturnValue(of({ data: mockItem })),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [OrdersModule],
    })
      .overrideProvider(HttpService)
      .useValue(mockHttpService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    dbService = moduleFixture.get<DbService>(DbService);
  });

  beforeEach(async () => {
    await dbService.db.delete(orders);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /orders', () => {
    it('should create order with valid data', () => {
      return request(app.getHttpServer())
        .post('/orders')
        .send({
          customerName: 'John Doe',
          menuItemId: mockItem.id,
          quantity: 2,
          street: '123 Main St',
          area: 'Downtown',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.orderId).toBeDefined();
        });
    });

    it('should return 400 when customerName is missing', () => {
      return request(app.getHttpServer())
        .post('/orders')
        .send({
          menuItemId: mockItem.id,
          quantity: 1,
          street: '123 Main St',
          area: 'Downtown',
        })
        .expect(400);
    });

    it('should return 400 when menuItemId is missing', () => {
      return request(app.getHttpServer())
        .post('/orders')
        .send({
          customerName: 'John Doe',
          quantity: 1,
          street: '123 Main St',
          area: 'Downtown',
        })
        .expect(400);
    });

    it('should return 400 when menuItemId is not a valid UUID', () => {
      return request(app.getHttpServer())
        .post('/orders')
        .send({
          customerName: 'John Doe',
          menuItemId: 'not-a-uuid',
          quantity: 1,
          street: '123 Main St',
          area: 'Downtown',
        })
        .expect(400);
    });

    it('should return 400 when quantity is less than 1', () => {
      return request(app.getHttpServer())
        .post('/orders')
        .send({
          customerName: 'John Doe',
          menuItemId: mockItem.id,
          quantity: 0,
          street: '123 Main St',
          area: 'Downtown',
        })
        .expect(400);
    });

    it('should return 400 when street is missing', () => {
      return request(app.getHttpServer())
        .post('/orders')
        .send({
          customerName: 'John Doe',
          menuItemId: mockItem.id,
          quantity: 1,
          area: 'Downtown',
        })
        .expect(400);
    });

    it('should return 400 when area is missing', () => {
      return request(app.getHttpServer())
        .post('/orders')
        .send({
          customerName: 'John Doe',
          menuItemId: mockItem.id,
          quantity: 1,
          street: '123 Main St',
        })
        .expect(400);
    });

    it('should return 404 when menu item does not exist', () => {
      mockHttpService.get.mockReturnValueOnce(
        throwError(() => new Error('Not Found')),
      );

      return request(app.getHttpServer())
        .post('/orders')
        .send({
          customerName: 'John Doe',
          menuItemId: '550e8400-e29b-41d4-a716-446655440001',
          quantity: 1,
          street: '123 Main St',
          area: 'Downtown',
        })
        .expect(404);
    });

    it('should save order with correct fields in database', async () => {
      const response = await request(app.getHttpServer())
        .post('/orders')
        .send({
          customerName: 'John Doe',
          menuItemId: mockItem.id,
          quantity: 3,
          street: '123 Main St',
          area: 'Downtown',
        })
        .expect(201);

      const results = await dbService.db
        .select()
        .from(orders)
        .where(eq(orders.id, response.body.orderId));

      expect(results).toHaveLength(1);
      const order = results[0];
      expect(order.customerName).toBe('John Doe');
      expect(order.menuItemId).toBe(mockItem.id);
      expect(order.itemName).toBe('Pizza');
      expect(order.itemPrice).toBe('1299');
      expect(order.quantity).toBe(3);
      expect(order.totalPrice).toBe('3897');
      expect(order.street).toBe('123 Main St');
      expect(order.area).toBe('Downtown');
      expect(order.status).toBe('pending');
    });

    it('should calculate totalPrice correctly', async () => {
      const response = await request(app.getHttpServer())
        .post('/orders')
        .send({
          customerName: 'Jane Doe',
          menuItemId: mockItem.id,
          quantity: 5,
          street: '456 Oak Ave',
          area: 'Uptown',
        })
        .expect(201);

      const results = await dbService.db
        .select()
        .from(orders)
        .where(eq(orders.id, response.body.orderId));

      expect(results[0].totalPrice).toBe(String(mockItem.price * 5));
    });
  });

  describe('Exception filter response format', () => {
    it('should return structured error for validation failure', () => {
      return request(app.getHttpServer())
        .post('/orders')
        .send({})
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 400);
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('path', '/orders');
          expect(typeof res.body.timestamp).toBe('string');
        });
    });

    it('should return structured error for not found', () => {
      mockHttpService.get.mockReturnValueOnce(
        throwError(() => new Error('Not Found')),
      );

      return request(app.getHttpServer())
        .post('/orders')
        .send({
          customerName: 'John Doe',
          menuItemId: '550e8400-e29b-41d4-a716-446655440001',
          quantity: 1,
          street: '123 Main St',
          area: 'Downtown',
        })
        .expect(404)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 404);
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('path', '/orders');
        });
    });
  });
});
