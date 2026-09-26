import { resolve } from 'path';
import * as dotenv from 'dotenv';

dotenv.config({
  path: resolve(__dirname, '..', '..', '.env.test'),
  override: true,
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { eq } from 'drizzle-orm';
import { AppService } from './app.service';
import { DbService } from '../db/db.service';
import { dispatches } from '../db/schema';

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

  const ordersClient = {
    emit: jest.fn(() => of({})),
  };
  const config = {
    get: (key: string, fallback?: string) => process.env[key] ?? fallback,
  };

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      providers: [
        AppService,
        DbService,
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
    if (orderId) {
      await dbService.db
        .delete(dispatches)
        .where(eq(dispatches.orderId, orderId));
      orderId = undefined;
    }
  });

  it('should persist phone and note on the dispatch', async () => {
    orderId = '550e8400-e29b-41d4-a716-446655440000';
    await service.dispatchRider({
      orderId,
      customerName: 'John Doe',
      lines: [{ itemName: 'Pizza', quantity: 2 }],
      street: '123 Main St',
      area: 'Downtown',
      phone: '+959123456789',
      note: 'Ring twice',
      correlationId: 'corr-1',
    });

    const rows = await dbService.db
      .select()
      .from(dispatches)
      .where(eq(dispatches.orderId, orderId));

    expect(rows).toHaveLength(1);
    expect(rows[0].phone).toBe('+959123456789');
    expect(rows[0].note).toBe('Ring twice');
  });

  it('should tolerate a payload without phone and note', async () => {
    orderId = '550e8400-e29b-41d4-a716-446655440001';
    await service.dispatchRider({
      orderId,
      customerName: 'John Doe',
      lines: [{ itemName: 'Pizza', quantity: 1 }],
      street: '123 Main St',
      area: 'Downtown',
      correlationId: 'corr-2',
    });

    const rows = await dbService.db
      .select()
      .from(dispatches)
      .where(eq(dispatches.orderId, orderId));

    expect(rows).toHaveLength(1);
    expect(rows[0].phone).toBeNull();
    expect(rows[0].note).toBeNull();
  });
});
