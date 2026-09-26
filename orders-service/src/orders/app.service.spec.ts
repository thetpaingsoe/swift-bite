import { resolve } from 'path';
import * as dotenv from 'dotenv';

dotenv.config({
  path: resolve(__dirname, '..', '..', '.env.test'),
  override: true,
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
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

describeDb('AppService phone and note snapshot', () => {
  let moduleFixture: TestingModule;
  let service: AppService;
  let dbService: DbService;
  let orderId: string | undefined;

  const userId = '11111111-1111-4111-8111-111111111111';
  const emitted: { pattern: unknown; payload: unknown }[] = [];
  const kitchenClient = {
    emit: jest.fn((pattern: unknown, payload: unknown) => {
      emitted.push({ pattern, payload });
      return of({});
    }),
  };

  const mockItem = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Pizza',
    price: 1299,
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
    if (orderId) {
      await dbService.db
        .delete(orderItems)
        .where(eq(orderItems.orderId, orderId));
      await dbService.db.delete(orders).where(eq(orders.id, orderId));
      orderId = undefined;
    }
    emitted.length = 0;
  });

  it('should persist phone and note on the order', async () => {
    const result = await service.createOrder(
      {
        customerName: 'John Doe',
        street: '123 Main St',
        area: 'Downtown',
        phone: '+959123456789',
        note: 'Ring twice',
        lines: [{ menuItemId: mockItem.id, quantity: 2 }],
      },
      userId,
    );

    orderId = result.orderId;
    const [row] = await dbService.db
      .select()
      .from(orders)
      .where(eq(orders.id, result.orderId));

    expect(row.phone).toBe('+959123456789');
    expect(row.note).toBe('Ring twice');
  });

  it('should include phone and note in the order_created payload', async () => {
    const result = await service.createOrder(
      {
        customerName: 'John Doe',
        street: '123 Main St',
        area: 'Downtown',
        phone: '+959123456789',
        lines: [{ menuItemId: mockItem.id, quantity: 1 }],
      },
      userId,
    );

    orderId = result.orderId;
    const event = emitted.find((e) => e.pattern === 'order_created');
    expect(event).toBeDefined();
    const payload = event?.payload as { phone: string; note: string | null };
    expect(payload.phone).toBe('+959123456789');
    expect(payload.note).toBeNull();
  });
});
