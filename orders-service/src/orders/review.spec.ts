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
import { ReviewService } from './review.service';
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

const kitchenClient = {
  emit: jest.fn(() => of({})),
};
const httpService = {
  get: jest.fn().mockReturnValue(
    of({
      data: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Pizza',
        price: 1299,
      },
    }),
  ),
};
const discovery = {
  getServiceUrl: jest.fn().mockResolvedValue('http://item-service:3001'),
  invalidate: jest.fn(),
};
const config = {
  get: (key: string, fallback?: string) => process.env[key] ?? fallback,
};

async function insertOrder(values: {
  status: string;
  readyAt?: Date | null;
  correlationId?: string | null;
}) {
  const [row] = await globalDb.db
    .insert(orders)
    .values({
      customerName: 'Review Case',
      totalPrice: '100',
      street: '1 Test St',
      area: 'Test Area',
      status: values.status,
      readyAt: values.readyAt ?? null,
      correlationId: values.correlationId ?? 'corr-review-1',
    })
    .returning();
  createdIds.push(row.id);
  return row;
}

async function getStatus(id: string) {
  const [row] = await globalDb.db
    .select({ status: orders.status, readyAt: orders.readyAt })
    .from(orders)
    .where(eq(orders.id, id));
  return row;
}

let globalDb: DbService;
const createdIds: string[] = [];

describeDb('rider-failure review compensation', () => {
  let moduleFixture: TestingModule;
  let appService: AppService;
  let reviewService: ReviewService;
  let savedAfterMin: string | undefined;

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

    globalDb = moduleFixture.get<DbService>(DbService);
    appService = moduleFixture.get<AppService>(AppService);
    reviewService = new ReviewService(
      globalDb,
      config as unknown as ConfigService,
    );
    savedAfterMin = process.env.RIDER_REVIEW_AFTER_MIN;
    delete process.env.RIDER_REVIEW_AFTER_MIN;
  });

  afterAll(async () => {
    if (savedAfterMin !== undefined) {
      process.env.RIDER_REVIEW_AFTER_MIN = savedAfterMin;
    }
    await moduleFixture.close();
  });

  afterEach(async () => {
    while (createdIds.length > 0) {
      const id = createdIds.pop()!;
      await globalDb.db.delete(orderItems).where(eq(orderItems.orderId, id));
      await globalDb.db.delete(orders).where(eq(orders.id, id));
    }
    delete process.env.RIDER_REVIEW_AFTER_MIN;
  });

  it('flags a stale ready order as needs_review', async () => {
    const row = await insertOrder({
      status: 'ready',
      readyAt: new Date(Date.now() - 20 * 60000),
    });

    const flagged = await reviewService.flagStaleReadyOrders();

    expect(flagged).toBe(1);
    expect((await getStatus(row.id)).status).toBe('needs_review');
  });

  it('leaves a fresh ready order alone', async () => {
    const row = await insertOrder({ status: 'ready', readyAt: new Date() });

    const flagged = await reviewService.flagStaleReadyOrders();

    expect(flagged).toBe(0);
    expect((await getStatus(row.id)).status).toBe('ready');
  });

  it('never flags ready orders with no ready_at (pre-deploy rows)', async () => {
    const row = await insertOrder({ status: 'ready', readyAt: null });

    const flagged = await reviewService.flagStaleReadyOrders();

    expect(flagged).toBe(0);
    expect((await getStatus(row.id)).status).toBe('ready');
  });

  it('leaves dispatched and cancelled orders alone', async () => {
    const old = new Date(Date.now() - 60 * 60000);
    const dispatched = await insertOrder({
      status: 'dispatched',
      readyAt: old,
    });
    const cancelled = await insertOrder({ status: 'cancelled', readyAt: old });

    const flagged = await reviewService.flagStaleReadyOrders();

    expect(flagged).toBe(0);
    expect((await getStatus(dispatched.id)).status).toBe('dispatched');
    expect((await getStatus(cancelled.id)).status).toBe('cancelled');
  });

  it('respects RIDER_REVIEW_AFTER_MIN', async () => {
    process.env.RIDER_REVIEW_AFTER_MIN = '60';
    const row = await insertOrder({
      status: 'ready',
      readyAt: new Date(Date.now() - 20 * 60000),
    });

    const flagged = await reviewService.flagStaleReadyOrders();

    expect(flagged).toBe(0);
    expect((await getStatus(row.id)).status).toBe('ready');
  });

  it('stamps ready_at when an order becomes ready', async () => {
    const row = await insertOrder({ status: 'cooking' });
    const before = (await getStatus(row.id)).readyAt;
    expect(before).toBeNull();

    await appService.updateStatus(row.id, 'ready');

    const after = await getStatus(row.id);
    expect(after.status).toBe('ready');
    expect(after.readyAt).toBeInstanceOf(Date);
  });

  it('does not re-stamp ready_at on a duplicate ready event', async () => {
    const row = await insertOrder({ status: 'cooking' });
    await appService.updateStatus(row.id, 'ready');

    const backdated = new Date(Date.now() - 5 * 60000);
    await globalDb.db
      .update(orders)
      .set({ readyAt: backdated })
      .where(eq(orders.id, row.id));

    await appService.updateStatus(row.id, 'ready');

    const after = await getStatus(row.id);
    expect(after.status).toBe('ready');
    expect(after.readyAt?.getTime()).toBe(backdated.getTime());
  });

  it('lets a late dispatch advance needs_review to dispatched', async () => {
    const row = await insertOrder({
      status: 'needs_review',
      readyAt: new Date(Date.now() - 20 * 60000),
    });

    await appService.updateStatus(row.id, 'dispatched');

    expect((await getStatus(row.id)).status).toBe('dispatched');
  });

  it('does not let a duplicate kitchen event regress needs_review', async () => {
    const row = await insertOrder({
      status: 'needs_review',
      readyAt: new Date(Date.now() - 20 * 60000),
    });

    await appService.updateStatus(row.id, 'ready');
    expect((await getStatus(row.id)).status).toBe('needs_review');

    await appService.updateStatus(row.id, 'cooking');
    expect((await getStatus(row.id)).status).toBe('needs_review');
  });

  it('still cancels from ready via the kitchen-reject path', async () => {
    const row = await insertOrder({ status: 'ready', readyAt: new Date() });

    await appService.updateStatus(row.id, 'cancelled');

    expect((await getStatus(row.id)).status).toBe('cancelled');
  });
});
