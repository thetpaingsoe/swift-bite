import { resolve } from 'path';
import * as dotenv from 'dotenv';

dotenv.config({
  path: resolve(__dirname, '..', '..', '.env.test'),
  override: true,
});

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { asc, eq, sql } from 'drizzle-orm';
import { OrdersService } from './orders.service';
import { ReviewService } from './review.service';
import { KitchenClientService } from '../kitchen-client/kitchen-client.service';
import { DbService } from '../db/db.service';
import { DiscoveryService } from '../consul/discovery.service';
import { orderEvents, orderItems, orders } from '../db/schema';
import { ListOrdersDto } from './dto/list-orders.dto';

const hasTestDb = Boolean(process.env.DATABASE_URL);
if (!hasTestDb) {
  console.warn(
    'Skipping DB-backed specs: DATABASE_URL is not set. See README (db:migrate:test).',
  );
}
const describeDb = hasTestDb ? describe : describe.skip;

const userId = '11111111-1111-4111-8111-111111111111';
const mockItem = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Pizza',
  price: 1299,
};

describeDb('order money split, payment state, and timeline', () => {
  let moduleFixture: TestingModule;
  let service: OrdersService;
  let reviewService: ReviewService;
  let dbService: DbService;
  const createdIds: string[] = [];

  const kitchenClientService = {
    emitOrderCreated: jest.fn(),
    connect: jest.fn(),
  };
  const httpService = {
    get: jest.fn().mockReturnValue(of({ data: mockItem })),
  };
  const discovery = {
    getServiceUrl: jest.fn().mockResolvedValue('http://item-service:3001'),
    invalidate: jest.fn(),
  };
  const config = {
    get: (key: string, fallback?: string) => process.env[key] ?? fallback,
  };

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      providers: [
        OrdersService,
        DbService,
        { provide: KitchenClientService, useValue: kitchenClientService },
        { provide: HttpService, useValue: httpService },
        { provide: DiscoveryService, useValue: discovery },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = moduleFixture.get<OrdersService>(OrdersService);
    dbService = moduleFixture.get<DbService>(DbService);
    reviewService = new ReviewService(
      dbService,
      config as unknown as ConfigService,
    );
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  afterEach(async () => {
    while (createdIds.length > 0) {
      const id = createdIds.pop()!;
      await dbService.db.delete(orderEvents).where(eq(orderEvents.orderId, id));
      await dbService.db.delete(orderItems).where(eq(orderItems.orderId, id));
      await dbService.db.delete(orders).where(eq(orders.id, id));
    }
  });

  async function createOrder(quantity = 2) {
    const result = await service.createOrder(
      {
        customerName: 'John Doe',
        street: '123 Main St',
        area: 'Downtown',
        phone: '+959123456789',
        lines: [{ menuItemId: mockItem.id, quantity }],
      },
      userId,
    );
    createdIds.push(result.orderId);
    return result.orderId;
  }

  async function getEvents(orderId: string) {
    return dbService.db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, orderId))
      .orderBy(asc(orderEvents.createdAt));
  }

  it('creates the money split with total equal to subtotal plus fee plus tax', async () => {
    const orderId = await createOrder(2);

    const [row] = await dbService.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId));

    expect(row.subtotal).toBe(String(1299 * 2));
    expect(row.fee).toBe('0');
    expect(row.tax).toBe('0');
    expect(row.totalPrice).toBe(String(1299 * 2));
  });

  it('starts new orders as payment pending with null intent and one pending event', async () => {
    const orderId = await createOrder();

    const [row] = await dbService.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId));

    expect(row.paymentStatus).toBe('pending');
    expect(row.paymentIntentId).toBeNull();
    expect(await getEvents(orderId)).toHaveLength(1);
    expect((await getEvents(orderId))[0].status).toBe('pending');
  });

  it('appends exactly one event per transition and ignores duplicate events', async () => {
    const orderId = await createOrder();

    await service.updateStatus(orderId, 'cooking');
    await service.updateStatus(orderId, 'cooking');
    await service.updateStatus(orderId, 'ready');
    await service.updateStatus(orderId, 'ready');
    await service.updateStatus(orderId, 'dispatched');
    await service.updateStatus(orderId, 'dispatched');

    const events = await getEvents(orderId);
    expect(events.map((e) => e.status)).toEqual([
      'pending',
      'cooking',
      'ready',
      'dispatched',
    ]);
  });

  it('flags needs_review with an event and lets a late dispatch through', async () => {
    const orderId = await createOrder();
    await service.updateStatus(orderId, 'cooking');
    await service.updateStatus(orderId, 'ready');
    await dbService.db
      .update(orders)
      .set({ readyAt: new Date(Date.now() - 20 * 60000) })
      .where(eq(orders.id, orderId));

    expect(await reviewService.flagStaleReadyOrders()).toBe(1);

    await service.updateStatus(orderId, 'cooking');
    await service.updateStatus(orderId, 'ready');
    await service.updateStatus(orderId, 'dispatched');

    const events = await getEvents(orderId);
    expect(events.map((e) => e.status)).toEqual([
      'pending',
      'cooking',
      'ready',
      'needs_review',
      'dispatched',
    ]);
  });

  it('returns events in ascending order on get and money fields on list', async () => {
    const orderId = await createOrder();
    await service.updateStatus(orderId, 'cooking');

    const one = await service.getOrder(orderId, userId, 'admin');
    expect(one.events.map((e: { status: string }) => e.status)).toEqual([
      'pending',
      'cooking',
    ]);

    const page = await service.listOrders(userId, 'admin', 1, 10);
    const listed = page.data.find((o) => o.id === orderId)!;
    expect(listed.subtotal).toBe(String(1299 * 2));
    expect(listed.fee).toBe('0');
    expect(listed.tax).toBe('0');
    expect(listed.paymentStatus).toBe('pending');
    expect(listed.paymentIntentId).toBeNull();
  });

  it('rejects a duplicate non-null intent while many nulls pass', async () => {
    const first = await createOrder();
    const second = await createOrder();

    await dbService.db
      .update(orders)
      .set({ paymentIntentId: 'pi_test_123' })
      .where(eq(orders.id, first));

    await expect(
      dbService.db
        .update(orders)
        .set({ paymentIntentId: 'pi_test_123' })
        .where(eq(orders.id, second)),
    ).rejects.toThrow();

    const [row] = await dbService.db
      .select()
      .from(orders)
      .where(eq(orders.id, second));
    expect(row.paymentIntentId).toBeNull();
  });

  it('leaves payment status untouched when cancelling from pending', async () => {
    const orderId = await createOrder();

    await service.cancelOrder(orderId, userId, 'admin');

    const [row] = await dbService.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId));
    expect(row.status).toBe('cancelled');
    expect(row.paymentStatus).toBe('pending');
    expect((await getEvents(orderId)).map((e) => e.status)).toEqual([
      'pending',
      'cancelled',
    ]);
  });

  it('backfills legacy rows to paid with one seeded event matching prior status', async () => {
    const [legacy] = await dbService.db
      .insert(orders)
      .values({
        customerName: 'Legacy Row',
        totalPrice: '5000',
        street: '9 Old Rd',
        area: 'Old Town',
        status: 'cooking',
      })
      .returning();
    createdIds.push(legacy.id);

    await dbService.db.execute(sql`
      UPDATE "orders" SET "subtotal" = "total_price", "fee" = '0', "tax" = '0', "payment_status" = 'paid', "payment_intent_id" = NULL
      WHERE "id" = ${legacy.id}`);
    await dbService.db.execute(sql`
      INSERT INTO "order_events" ("order_id", "status", "created_at")
      SELECT "id", "status", "created_at" FROM "orders" WHERE "id" = ${legacy.id}`);

    const [row] = await dbService.db
      .select()
      .from(orders)
      .where(eq(orders.id, legacy.id));
    expect(row.subtotal).toBe('5000');
    expect(row.fee).toBe('0');
    expect(row.tax).toBe('0');
    expect(row.paymentStatus).toBe('paid');
    expect(row.paymentIntentId).toBeNull();

    const events = await getEvents(legacy.id);
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe('cooking');
  });

  it.each(['paid', 'failed', 'refunded'])(
    'rejects payment value %s as a status filter',
    async (status) => {
      const dto = plainToInstance(ListOrdersDto, { status });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('status');
    },
  );
});
