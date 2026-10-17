import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { eq } from 'drizzle-orm';
import { ThrottlerGuard } from '@nestjs/throttler';
import { OrdersModule } from '../src/orders/orders.module';
import { DbService } from '../src/db/db.service';
import { orderItems, orders } from '../src/db/schema';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { KitchenClientService } from '../src/kitchen-client/kitchen-client.service';

describe('Orders (e2e)', () => {
  let app: INestApplication<App>;
  let dbService: DbService;
  let mockHttpService: { get: jest.Mock };
  let kitchenClient: { emitOrderCreated: jest.Mock };

  const userId = '11111111-1111-4111-8111-111111111111';
  const mockUser = { userId, email: 'test@example.com', role: 'customer' };
  const mockItem = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Pizza',
    price: 1299,
  };
  const secondItemId = '550e8400-e29b-41d4-a716-446655440002';

  const orderBody = {
    customerName: 'John Doe',
    lines: [{ menuItemId: mockItem.id, quantity: 2 }],
    street: '123 Main St',
    area: 'Downtown',
    phone: '+959123456789',
  };

  function respondToGet(url: string) {
    if (url.includes('/auth/verify')) {
      return of({ data: mockUser });
    }
    return of({
      data: url.endsWith(secondItemId) ? { ...mockItem, price: 999 } : mockItem,
    });
  }

  beforeAll(async () => {
    mockHttpService = {
      get: jest.fn((url: string) => respondToGet(url)),
    };
    kitchenClient = {
      emitOrderCreated: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [OrdersModule],
    })
      .overrideProvider(HttpService)
      .useValue(mockHttpService)
      .overrideProvider(KitchenClientService)
      .useValue(kitchenClient)
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    dbService = moduleFixture.get<DbService>(DbService);
  });

  function placeOrder(body: object) {
    return request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', 'Bearer test-token')
      .set('x-correlation-id', 'corr-e2e')
      .send(body);
  }

  function failItemLookups() {
    mockHttpService.get.mockImplementation((url: string) =>
      url.includes('/auth/verify')
        ? of({ data: mockUser })
        : throwError(() => new Error('Not Found')),
    );
  }

  beforeEach(async () => {
    mockHttpService.get.mockImplementation((url: string) => respondToGet(url));
    kitchenClient.emitOrderCreated.mockClear();
    await dbService.db.delete(orders);
  });

  afterAll(async () => {
    await dbService.db.delete(orders);
    await app.close();
  });

  describe('POST /orders', () => {
    it('should create order with valid data', () => {
      return placeOrder(orderBody)
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.orderId).toBeDefined();
        });
    });

    it('should return 400 when customerName is missing', () => {
      return placeOrder({ ...orderBody, customerName: undefined }).expect(400);
    });

    it('should return 400 when lines is missing', () => {
      return placeOrder({ ...orderBody, lines: undefined }).expect(400);
    });

    it('should return 400 when lines is empty', () => {
      return placeOrder({ ...orderBody, lines: [] }).expect(400);
    });

    it('should return 400 when menuItemId is not a valid UUID', () => {
      return placeOrder({
        ...orderBody,
        lines: [{ menuItemId: 'nope', quantity: 1 }],
      }).expect(400);
    });

    it('should return 400 when quantity is less than 1', () => {
      return placeOrder({
        ...orderBody,
        lines: [{ menuItemId: mockItem.id, quantity: 0 }],
      }).expect(400);
    });

    it('should return 400 when street is missing', () => {
      return placeOrder({ ...orderBody, street: undefined }).expect(400);
    });

    it('should return 400 when area is missing', () => {
      return placeOrder({ ...orderBody, area: undefined }).expect(400);
    });

    it('should return 400 when phone is missing', () => {
      return placeOrder({ ...orderBody, phone: undefined }).expect(400);
    });

    it('should return 400 for unknown fields', () => {
      return placeOrder({ ...orderBody, sneaky: true }).expect(400);
    });

    it('should return 404 when menu item does not exist', () => {
      failItemLookups();

      return placeOrder({
        ...orderBody,
        lines: [
          { menuItemId: '550e8400-e29b-41d4-a716-446655440001', quantity: 1 },
        ],
      }).expect(404);
    });

    it('should save the order and its lines with correct fields', async () => {
      const response = await placeOrder({
        ...orderBody,
        lines: [{ menuItemId: mockItem.id, quantity: 3 }],
        note: 'Leave at the door',
      }).expect(201);

      const [order] = await dbService.db
        .select()
        .from(orders)
        .where(eq(orders.id, response.body.orderId));

      expect(order.customerName).toBe('John Doe');
      expect(order.userId).toBe(userId);
      expect(order.street).toBe('123 Main St');
      expect(order.area).toBe('Downtown');
      expect(order.phone).toBe('+959123456789');
      expect(order.note).toBe('Leave at the door');
      expect(order.status).toBe('pending');
      expect(order.paymentStatus).toBe('pending');
      expect(order.subtotal).toBe('3897');
      expect(order.fee).toBe('0');
      expect(order.tax).toBe('0');
      expect(order.totalPrice).toBe('3897');

      const lines = await dbService.db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));

      expect(lines).toHaveLength(1);
      expect(lines[0].menuItemId).toBe(mockItem.id);
      expect(lines[0].itemName).toBe('Pizza');
      expect(lines[0].itemPrice).toBe('1299');
      expect(lines[0].quantity).toBe(3);
    });

    it('should total across multiple lines', async () => {
      const response = await placeOrder({
        ...orderBody,
        lines: [
          { menuItemId: mockItem.id, quantity: 2 },
          { menuItemId: secondItemId, quantity: 1 },
        ],
      }).expect(201);

      const [order] = await dbService.db
        .select()
        .from(orders)
        .where(eq(orders.id, response.body.orderId));

      expect(order.totalPrice).toBe('3597');
    });

    it('should notify the kitchen exactly once with the order payload', async () => {
      await placeOrder(orderBody).expect(201);

      expect(kitchenClient.emitOrderCreated).toHaveBeenCalledTimes(1);
      const [order, lines, correlationId] = kitchenClient.emitOrderCreated.mock
        .calls[0] as [
        { customerName: string; phone: string | null; totalPrice: string },
        { menuItemId: string; itemName: string; quantity: number }[],
        string,
      ];
      expect(order.customerName).toBe('John Doe');
      expect(order.phone).toBe('+959123456789');
      expect(order.totalPrice).toBe('2598');
      expect(lines).toEqual([
        expect.objectContaining({
          menuItemId: mockItem.id,
          itemName: 'Pizza',
          quantity: 2,
        }),
      ]);
      expect(correlationId).toBe('corr-e2e');
    });
  });

  describe('Exception filter response format', () => {
    it('should return structured error for validation failure', () => {
      return placeOrder({})
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 400);
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('path', '/orders');
          expect(typeof res.body.timestamp).toBe('string');
        });
    });

    it('should return structured error for not found', () => {
      failItemLookups();

      return placeOrder({
        ...orderBody,
        lines: [
          { menuItemId: '550e8400-e29b-41d4-a716-446655440001', quantity: 1 },
        ],
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
