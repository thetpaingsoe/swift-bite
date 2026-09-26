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
import { tickets } from '../db/schema';

const hasTestDb = Boolean(process.env.DATABASE_URL);
if (!hasTestDb) {
  console.warn(
    'Skipping DB-backed specs: DATABASE_URL is not set. See README (db:migrate:test).',
  );
}
const describeDb = hasTestDb ? describe : describe.skip;

describeDb('AppService phone and note flow', () => {
  let moduleFixture: TestingModule;
  let service: AppService;
  let dbService: DbService;
  let ticketId: string | undefined;

  const emitted: { pattern: unknown; payload: unknown }[] = [];
  const riderClient = {
    emit: jest.fn((pattern: unknown, payload: unknown) => {
      emitted.push({ pattern, payload });
      return of({});
    }),
  };
  const ordersClient = {
    emit: jest.fn(() => of({})),
  };
  const config = {
    get: (key: string, fallback?: string) => process.env[key] ?? fallback,
  };

  const ticketData = {
    orderId: '550e8400-e29b-41d4-a716-446655440000',
    customerName: 'John Doe',
    lines: [{ itemName: 'Pizza', quantity: 2 }],
    street: '123 Main St',
    area: 'Downtown',
    phone: '+959123456789',
    note: 'Ring twice',
    correlationId: 'corr-1',
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
    if (ticketId) {
      await dbService.db.delete(tickets).where(eq(tickets.id, ticketId));
      ticketId = undefined;
    }
    emitted.length = 0;
  });

  it('should persist phone and note on the ticket', async () => {
    const ticket = await service.createTicket(ticketData);
    ticketId = ticket.id;

    const [row] = await dbService.db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticket.id));

    expect(row.phone).toBe('+959123456789');
    expect(row.note).toBe('Ring twice');
  });

  it('should forward phone and note in the order_ready payload', async () => {
    const ticket = await service.createTicket(ticketData);
    ticketId = ticket.id;

    await service.acceptTicket(ticket.id);
    await service.completeTicket(ticket.id);

    const event = emitted.find((e) => e.pattern === 'order_ready');
    expect(event).toBeDefined();
    const payload = event?.payload as { phone: string; note: string };
    expect(payload.phone).toBe('+959123456789');
    expect(payload.note).toBe('Ring twice');
  });

  it('should tolerate a payload without phone and note', async () => {
    const ticket = await service.createTicket({
      orderId: '550e8400-e29b-41d4-a716-446655440002',
      customerName: 'John Doe',
      lines: [{ itemName: 'Pizza', quantity: 2 }],
      street: '123 Main St',
      area: 'Downtown',
      correlationId: 'corr-3',
    });
    ticketId = ticket.id;

    const [row] = await dbService.db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticket.id));

    expect(row.phone).toBeNull();
    expect(row.note).toBeNull();
  });
});
