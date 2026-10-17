import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import type { RmqContext } from '@nestjs/microservices';
import { eq } from 'drizzle-orm';
import { of } from 'rxjs';
import { DispatchesModule } from '../src/dispatches/dispatches.module';
import { DispatchesController } from '../src/dispatches/dispatches.controller';
import { DbService } from '../src/db/db.service';
import { dispatches } from '../src/db/schema';
import { DlqService } from '../src/dlq/dlq.service';

function makeContext(channel: unknown, message: unknown): RmqContext {
  return {
    getChannelRef: () => channel,
    getMessage: () => message,
  } as unknown as RmqContext;
}

describe('Rider Service (e2e)', () => {
  let app: INestApplication;
  let dbService: DbService;
  let controller: DispatchesController;
  let ordersClient: { emit: jest.Mock; connect: jest.Mock };
  let channel: { ack: jest.Mock; nack: jest.Mock };
  const message = { deliveryTag: 1 };

  const orderReady = {
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
    ordersClient = {
      emit: jest.fn().mockReturnValue(of(undefined)),
      connect: jest.fn(),
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DispatchesModule],
    })
      .overrideProvider('ORDERS_SERVICE')
      .useValue(ordersClient)
      .overrideProvider(DlqService)
      .useValue({ onModuleInit: jest.fn(), onModuleDestroy: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dbService = moduleFixture.get<DbService>(DbService);
    controller = moduleFixture.get<DispatchesController>(DispatchesController);
  });

  beforeEach(async () => {
    channel = { ack: jest.fn(), nack: jest.fn() };
    ordersClient.emit.mockClear();
    await dbService.db.delete(dispatches);
  });

  afterAll(async () => {
    await dbService.db.delete(dispatches);
    await app.close();
  });

  it('creates a dispatch from order_ready and acks the message', async () => {
    await controller.handle(orderReady, makeContext(channel, message));

    const results = await dbService.db
      .select()
      .from(dispatches)
      .where(eq(dispatches.orderId, orderReady.orderId));

    expect(results).toHaveLength(1);
    const dispatch = results[0];
    expect(dispatch.customerName).toBe('John Doe');
    expect(dispatch.items).toEqual(orderReady.lines);
    expect(dispatch.street).toBe('123 Main St');
    expect(dispatch.area).toBe('Downtown');
    expect(dispatch.phone).toBe('+959123456789');
    expect(dispatch.note).toBe('Extra cheese');
    expect(dispatch.correlationId).toBe('corr-1');
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();

    expect(ordersClient.emit).toHaveBeenCalledTimes(1);
    const [event, payload] = ordersClient.emit.mock.calls[0] as [
      string,
      { orderId: string; riderName: string; correlationId: string },
    ];
    expect(event).toBe('order_dispatched');
    expect(payload.orderId).toBe(orderReady.orderId);
    expect(payload.correlationId).toBe('corr-1');
    expect(typeof payload.riderName).toBe('string');
    expect(payload.riderName.length).toBeGreaterThan(0);
  });

  it('defaults the dispatch status to dispatched', async () => {
    await controller.handle(orderReady, makeContext(channel, message));

    const results = await dbService.db.select().from(dispatches);
    expect(results[0].riderStatus).toBe('dispatched');
  });

  it('mints a correlationId when the payload has none', async () => {
    await controller.handle(
      { ...orderReady, correlationId: undefined },
      makeContext(channel, message),
    );

    const results = await dbService.db.select().from(dispatches);
    expect(results[0].correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('nacks a malformed payload without creating a dispatch', async () => {
    await controller.handle(
      { ...orderReady, lines: undefined } as never,
      makeContext(channel, message),
    );

    const results = await dbService.db.select().from(dispatches);
    expect(results).toHaveLength(0);
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('handles multiple dispatches', async () => {
    await controller.handle(orderReady, makeContext(channel, message));
    await controller.handle(
      {
        ...orderReady,
        orderId: '550e8400-e29b-41d4-a716-446655440001',
        lines: [{ ...orderReady.lines[0], itemName: 'Burger' }],
      },
      makeContext(channel, message),
    );

    const allDispatches = await dbService.db.select().from(dispatches);
    expect(allDispatches).toHaveLength(2);
  });

  it('creates a second dispatch when the same order_ready arrives twice', async () => {
    await controller.handle(orderReady, makeContext(channel, message));
    await controller.handle(orderReady, makeContext(channel, message));

    const results = await dbService.db
      .select()
      .from(dispatches)
      .where(eq(dispatches.orderId, orderReady.orderId));

    expect(results).toHaveLength(2);
    expect(ordersClient.emit).toHaveBeenCalledTimes(2);
  });
});
