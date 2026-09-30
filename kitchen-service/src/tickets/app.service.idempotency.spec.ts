import { resolve } from 'path';
import * as dotenv from 'dotenv';

dotenv.config({
  path: resolve(__dirname, '..', '..', '.env.test'),
  override: true,
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { count, eq } from 'drizzle-orm';
import { AppService } from './app.service';
import { DbService } from '../db/db.service';
import { tickets } from '../db/schema';

const hasTestDb = Boolean(process.env.DATABASE_URL);
if (!hasTestDb) {
  console.warn(
    'Skipping DB-backed specs: DATABASE_URL is not set. See README (db:migrate:test).',
  );
}
const describeDb = hasTestDb ? describe : describe.skip;

describeDb('createTicket idempotency on orderId', () => {
  let moduleFixture: TestingModule;
  let service: AppService;
  let dbService: DbService;
  const orderId = '550e8400-e29b-41d4-a716-446655440099';
  const createdTicketIds: string[] = [];

  const riderClient = { emit: jest.fn(() => of({})) };
  const ordersClient = { emit: jest.fn(() => of({})) };
  const config = {
    get: (key: string, fallback?: string) => process.env[key] ?? fallback,
  };

  const ticketData = {
    orderId,
    customerName: 'Jane Doe',
    lines: [{ itemName: 'Noodles', quantity: 1 }],
    street: '5 Dup St',
    area: 'Uptown',
    phone: '+959987654321',
    note: 'Extra chili',
    correlationId: 'corr-dupe-1',
  };

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      providers: [
        AppService,
        DbService,
        { provide: 'RIDER_SERVICE', useValue: riderClient },
        { provide: 'ORDERS_SERVICE', useValue: ordersClient },
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
    while (createdTicketIds.length > 0) {
      const id = createdTicketIds.pop()!;
      await dbService.db.delete(tickets).where(eq(tickets.id, id));
    }
  });

  it('creates no second ticket on a duplicate order_created', async () => {
    const first = await service.createTicket({ ...ticketData });
    createdTicketIds.push(first.id);

    const second = await service.createTicket({
      ...ticketData,
      correlationId: 'corr-dupe-2',
    });
    if (!createdTicketIds.includes(second.id)) {
      createdTicketIds.push(second.id);
    }

    expect(second.id).toBe(first.id);

    const [{ total }] = await dbService.db
      .select({ total: count() })
      .from(tickets)
      .where(eq(tickets.orderId, orderId));
    expect(total).toBe(1);

    const [row] = await dbService.db
      .select()
      .from(tickets)
      .where(eq(tickets.orderId, orderId));
    expect(row.phone).toBe('+959987654321');
    expect(row.note).toBe('Extra chili');
  });

  it('tolerates two concurrent duplicate order_created deliveries', async () => {
    const concurrentOrderId = '550e8400-e29b-41d4-a716-446655440100';
    const payload = {
      ...ticketData,
      orderId: concurrentOrderId,
      correlationId: 'corr-dupe-race',
    };

    const [first, second] = await Promise.all([
      service.createTicket({ ...payload }),
      service.createTicket({ ...payload }),
    ]);
    createdTicketIds.push(first.id);
    if (second.id !== first.id) {
      createdTicketIds.push(second.id);
    }

    expect(second.id).toBe(first.id);

    const [{ total }] = await dbService.db
      .select({ total: count() })
      .from(tickets)
      .where(eq(tickets.orderId, concurrentOrderId));
    expect(total).toBe(1);
  });
});
