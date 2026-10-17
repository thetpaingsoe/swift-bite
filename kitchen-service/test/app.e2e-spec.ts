import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import type { RmqContext } from '@nestjs/microservices';
import { eq } from 'drizzle-orm';
import { of } from 'rxjs';
import { TicketsModule } from '../src/tickets/tickets.module';
import { TicketsController } from '../src/tickets/tickets.controller';
import { DbService } from '../src/db/db.service';
import { tickets } from '../src/db/schema';
import { DlqService } from '../src/dlq/dlq.service';

function makeContext(channel: unknown, message: unknown): RmqContext {
  return {
    getChannelRef: () => channel,
    getMessage: () => message,
  } as unknown as RmqContext;
}

describe('Kitchen Service (e2e)', () => {
  let app: INestApplication;
  let dbService: DbService;
  let controller: TicketsController;
  let channel: { ack: jest.Mock; nack: jest.Mock };
  const message = { deliveryTag: 1 };

  const orderCreated = {
    orderId: '550e8400-e29b-41d4-a716-446655440000',
    customerName: 'John Doe',
    lines: [
      {
        menuItemId: '550e8400-e29b-41d4-a716-446655440010',
        itemName: 'Pizza',
        quantity: 2,
      },
    ],
    street: '123 Main St',
    area: 'Downtown',
    phone: '+959123456789',
    note: 'Extra cheese',
    correlationId: 'corr-1',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TicketsModule],
    })
      .overrideProvider('RIDER_SERVICE')
      .useValue({
        emit: jest.fn().mockReturnValue(of(undefined)),
        connect: jest.fn(),
      })
      .overrideProvider('ORDERS_SERVICE')
      .useValue({
        emit: jest.fn().mockReturnValue(of(undefined)),
        connect: jest.fn(),
      })
      .overrideProvider(DlqService)
      .useValue({ onModuleInit: jest.fn(), onModuleDestroy: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dbService = moduleFixture.get<DbService>(DbService);
    controller = moduleFixture.get<TicketsController>(TicketsController);
  });

  beforeEach(async () => {
    channel = { ack: jest.fn(), nack: jest.fn() };
    await dbService.db.delete(tickets);
  });

  afterAll(async () => {
    await dbService.db.delete(tickets);
    await app.close();
  });

  it('creates a ticket from order_created and acks the message', async () => {
    await controller.handleOrderCreated(
      orderCreated,
      makeContext(channel, message),
    );

    const results = await dbService.db
      .select()
      .from(tickets)
      .where(eq(tickets.orderId, orderCreated.orderId));

    expect(results).toHaveLength(1);
    const ticket = results[0];
    expect(ticket.customerName).toBe('John Doe');
    expect(ticket.items).toEqual(orderCreated.lines);
    expect(ticket.street).toBe('123 Main St');
    expect(ticket.area).toBe('Downtown');
    expect(ticket.phone).toBe('+959123456789');
    expect(ticket.note).toBe('Extra cheese');
    expect(ticket.correlationId).toBe('corr-1');
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('defaults the ticket status to received', async () => {
    await controller.handleOrderCreated(
      orderCreated,
      makeContext(channel, message),
    );

    const results = await dbService.db.select().from(tickets);
    expect(results[0].status).toBe('received');
  });

  it('mints a correlationId when the payload has none', async () => {
    await controller.handleOrderCreated(
      { ...orderCreated, correlationId: undefined },
      makeContext(channel, message),
    );

    const results = await dbService.db.select().from(tickets);
    expect(results[0].correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('nacks a malformed payload without creating a ticket', async () => {
    await controller.handleOrderCreated(
      { ...orderCreated, lines: undefined } as never,
      makeContext(channel, message),
    );

    const results = await dbService.db.select().from(tickets);
    expect(results).toHaveLength(0);
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('keeps one ticket when the same order arrives twice', async () => {
    await controller.handleOrderCreated(
      orderCreated,
      makeContext(channel, message),
    );
    await controller.handleOrderCreated(
      orderCreated,
      makeContext(channel, message),
    );

    const results = await dbService.db.select().from(tickets);
    expect(results).toHaveLength(1);
  });

  it('handles multiple orders', async () => {
    await controller.handleOrderCreated(
      orderCreated,
      makeContext(channel, message),
    );
    await controller.handleOrderCreated(
      {
        ...orderCreated,
        orderId: '550e8400-e29b-41d4-a716-446655440001',
        lines: [{ ...orderCreated.lines[0], itemName: 'Burger' }],
      },
      makeContext(channel, message),
    );

    const allTickets = await dbService.db.select().from(tickets);
    expect(allTickets).toHaveLength(2);
  });
});
