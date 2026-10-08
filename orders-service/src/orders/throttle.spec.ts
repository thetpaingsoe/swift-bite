import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { AuthGuard } from '../auth/auth.guard';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

describe('POST /orders throttling (SPEC-4.3)', () => {
  let app: INestApplication<App>;
  let appService: { createOrder: jest.Mock; listOrders: jest.Mock };

  const orderBody = {
    customerName: 'Throttle Test',
    lines: [
      { menuItemId: '550e8400-e29b-41d4-a716-446655440000', quantity: 1 },
    ],
    street: '123 Main St',
    area: 'Downtown',
    phone: '+959123456789',
  };

  beforeAll(async () => {
    appService = {
      createOrder: jest
        .fn()
        .mockResolvedValue({ success: true, orderId: 'order-1' }),
      listOrders: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ ttl: 2000, limit: 3 }],
          errorMessage: (_ctx, detail) =>
            `Too many orders, retry after ${detail?.timeToExpire ?? 2}s`,
        }),
      ],
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: appService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
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

  it('allows orders within the limit', async () => {
    for (let i = 0; i < 3; i += 1) {
      await request(app.getHttpServer())
        .post('/orders')
        .send(orderBody)
        .expect(201);
    }
    expect(appService.createOrder).toHaveBeenCalledTimes(3);
  });

  it('rejects the burst over the limit with 429 and creates no order', async () => {
    const res = await request(app.getHttpServer())
      .post('/orders')
      .send(orderBody)
      .expect(429);

    const body = res.body as { statusCode?: number; message?: unknown };
    expect(body.statusCode).toBe(429);
    expect(String(body.message)).toMatch(/retry after/i);
    expect(res.headers['retry-after']).toBeDefined();
    expect(appService.createOrder).toHaveBeenCalledTimes(3);
  });

  it('leaves order reads (GET /orders) unthrottled', async () => {
    for (let i = 0; i < 5; i += 1) {
      await request(app.getHttpServer()).get('/orders').expect(200);
    }
  });

  it('restores 201 once the window expires', async () => {
    await new Promise((resolve) => setTimeout(resolve, 2200));
    await request(app.getHttpServer())
      .post('/orders')
      .send(orderBody)
      .expect(201);
    expect(appService.createOrder).toHaveBeenCalledTimes(4);
  });
});
