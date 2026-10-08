import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { Transport, ClientProxy } from '@nestjs/microservices';
import { eq } from 'drizzle-orm';
import { TicketsModule } from '../src/tickets/tickets.module';
import { TicketsController } from '../src/tickets/tickets.controller';
import { DbService } from '../src/db/db.service';
import { tickets } from '../src/db/schema';

describe('Kitchen Service (e2e)', () => {
  let app: INestMicroservice;
  let dbService: DbService;
  let controller: TicketsController;
  let clientProxy: ClientProxy;

  const mockOrderCreated = {
    orderId: '550e8400-e29b-41d4-a716-446655440000',
    customerName: 'John Doe',
    itemName: 'Pizza',
    quantity: 2,
    street: '123 Main St',
    area: 'Downtown',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TicketsModule],
    }).compile();

    app = moduleFixture.createNestMicroservice({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 0 },
    });

    await app.listen();

    dbService = moduleFixture.get<DbService>(DbService);
    controller = moduleFixture.get<TicketsController>(TicketsController);
    clientProxy = moduleFixture.get<ClientProxy>('RIDER_SERVICE');
  });

  beforeEach(async () => {
    await dbService.db.delete(tickets);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should save ticket to database with correct fields', async () => {
    await controller.handleOrderCreated(mockOrderCreated);

    const results = await dbService.db
      .select()
      .from(tickets)
      .where(eq(tickets.orderId, mockOrderCreated.orderId));

    expect(results).toHaveLength(1);
    const ticket = results[0];
    expect(ticket.orderId).toBe(mockOrderCreated.orderId);
    expect(ticket.customerName).toBe(mockOrderCreated.customerName);
    expect(ticket.itemName).toBe(mockOrderCreated.itemName);
    expect(ticket.quantity).toBe(mockOrderCreated.quantity);
    expect(ticket.street).toBe(mockOrderCreated.street);
    expect(ticket.area).toBe(mockOrderCreated.area);
    expect(ticket.status).toBe('received');
  });

  it('should default status to received', async () => {
    await controller.handleOrderCreated(mockOrderCreated);

    const results = await dbService.db
      .select()
      .from(tickets)
      .where(eq(tickets.orderId, mockOrderCreated.orderId));

    expect(results[0].status).toBe('received');
  });

  it('should emit order_ready event to rider service', async () => {
    const emitSpy = jest.spyOn(clientProxy, 'emit');

    await controller.handleOrderCreated(mockOrderCreated);

    expect(emitSpy).toHaveBeenCalledWith('order_ready', {
      orderId: mockOrderCreated.orderId,
      customerName: mockOrderCreated.customerName,
      itemName: mockOrderCreated.itemName,
      quantity: mockOrderCreated.quantity,
      street: mockOrderCreated.street,
      area: mockOrderCreated.area,
    });
  });

  it('should handle multiple orders', async () => {
    await controller.handleOrderCreated(mockOrderCreated);
    await controller.handleOrderCreated({
      ...mockOrderCreated,
      orderId: '550e8400-e29b-41d4-a716-446655440001',
      itemName: 'Burger',
    });

    const allTickets = await dbService.db.select().from(tickets);
    expect(allTickets).toHaveLength(2);
  });
});
