import { resolve } from 'path';
import * as dotenv from 'dotenv';

dotenv.config({
  path: resolve(__dirname, '..', '..', '.env.test'),
  override: true,
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { eq } from 'drizzle-orm';
import { AppService } from './app.service';
import { DbService } from '../db/db.service';
import { DiscoveryService } from '../consul/discovery.service';
import { orderItems, orders } from '../db/schema';

const hasTestDb = Boolean(process.env.DATABASE_URL);
if (!hasTestDb) {
  console.warn(
    'Skipping DB-backed specs: DATABASE_URL is not set. See README (db:migrate:test).',
  );
}
const describeDb = hasTestDb ? describe : describe.skip;

describeDb('order_created guaranteed delivery', () => {
  let moduleFixture: TestingModule;
  let service: AppService;
  let dbService: DbService;
  const createdIds: string[] = [];

  const userId = '11111111-1111-4111-8111-111111111111';
  const mockItem = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Pizza',
    price: 1299,
  };
  const emitted: { pattern: unknown; payload: unknown }[] = [];
  const kitchenClient = {
    emit: jest.fn((pattern: unknown, payload: unknown) => {
      emitted.push({ pattern, payload });
      return of({});
    }),
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

  const orderInput = {
    customerName: 'Recon Case',
    street: '1 Test St',
    area: 'Test Area',
    phone: '+959123456789',
    note: 'Ring twice',
    lines: [{ menuItemId: mockItem.id, quantity: 2 }],
  };

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      providers: [
        AppService,
        DbService,
        { provide: 'KITCHEN_SERVICE', useValue: kitchenClient },
        { provide: HttpService, useValue: httpService },
        { provide: DiscoveryService, useValue: discovery },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = moduleFixture.get<AppService>(AppService);
    dbService = moduleFixture.get<DbService>(DbService);
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  afterEach(async () => {
    while (createdIds.length > 0) {
      const id = createdIds.pop()!;
      await dbService.db.delete(orderItems).where(eq(orderItems.orderId, id));
      await dbService.db.delete(orders).where(eq(orders.id, id));
    }
    emitted.length = 0;
    kitchenClient.emit.mockImplementation(
      (pattern: unknown, payload: unknown) => {
        emitted.push({ pattern, payload });
        return of({});
      },
    );
  });

  it('flags the order unsent when the emit fails, buyer still gets success', async () => {
    kitchenClient.emit.mockImplementationOnce(() =>
      throwError(() => new Error('broker down')),
    );

    const result = await service.createOrder({ ...orderInput }, userId);
    createdIds.push(result.orderId);

    expect(result.success).toBe(true);
    const [row] = await dbService.db
      .select()
      .from(orders)
      .where(eq(orders.id, result.orderId));
    expect(row.status).toBe('pending');
    expect(row.kitchenNotified).toBe(false);
  });

  it('reconciler re-emits flagged rows with phone and note, then clears the flag', async () => {
    const [row] = await dbService.db
      .insert(orders)
      .values({
        userId,
        customerName: 'Recon Case',
        totalPrice: '2598',
        street: '1 Test St',
        area: 'Test Area',
        phone: '+959123456789',
        note: 'Ring twice',
        status: 'pending',
        kitchenNotified: false,
        correlationId: 'corr-recon-1',
      })
      .returning();
    createdIds.push(row.id);
    await dbService.db.insert(orderItems).values({
      orderId: row.id,
      menuItemId: mockItem.id,
      itemName: 'Pizza',
      itemPrice: '1299',
      quantity: 2,
    });

    const count = await service.reconcileUnsentOrders();

    expect(count).toBe(1);
    const event = emitted.find((e) => e.pattern === 'order_created');
    expect(event).toBeDefined();
    const payload = event?.payload as {
      orderId: string;
      phone: string;
      note: string;
      lines: { itemName: string; quantity: number }[];
    };
    expect(payload.orderId).toBe(row.id);
    expect(payload.phone).toBe('+959123456789');
    expect(payload.note).toBe('Ring twice');
    expect(payload.lines).toEqual([
      expect.objectContaining({ itemName: 'Pizza', quantity: 2 }),
    ]);
    const [after] = await dbService.db
      .select()
      .from(orders)
      .where(eq(orders.id, row.id));
    expect(after.kitchenNotified).toBe(true);
  });

  it('leaves the flag untouched when the re-emit fails again', async () => {
    const [row] = await dbService.db
      .insert(orders)
      .values({
        userId,
        customerName: 'Recon Case',
        totalPrice: '2598',
        street: '1 Test St',
        area: 'Test Area',
        status: 'pending',
        kitchenNotified: false,
        correlationId: 'corr-recon-2',
      })
      .returning();
    createdIds.push(row.id);
    await dbService.db.insert(orderItems).values({
      orderId: row.id,
      menuItemId: mockItem.id,
      itemName: 'Pizza',
      itemPrice: '1299',
      quantity: 1,
    });
    kitchenClient.emit.mockImplementationOnce(() =>
      throwError(() => new Error('broker still down')),
    );

    const count = await service.reconcileUnsentOrders();

    expect(count).toBe(0);
    const [after] = await dbService.db
      .select()
      .from(orders)
      .where(eq(orders.id, row.id));
    expect(after.kitchenNotified).toBe(false);
  });

  it('finds nothing to do on the happy path', async () => {
    const result = await service.createOrder({ ...orderInput }, userId);
    createdIds.push(result.orderId);

    const [row] = await dbService.db
      .select()
      .from(orders)
      .where(eq(orders.id, result.orderId));
    expect(row.kitchenNotified).toBe(true);

    emitted.length = 0;
    const count = await service.reconcileUnsentOrders();
    expect(count).toBe(0);
    expect(emitted).toHaveLength(0);
  });
});
