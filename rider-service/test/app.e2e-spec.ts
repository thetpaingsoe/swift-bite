import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { Transport } from '@nestjs/microservices';
import { eq } from 'drizzle-orm';
import { DispatchesModule } from '../src/dispatches/dispatches.module';
import { DispatchesController } from '../src/dispatches/dispatches.controller';
import { DbService } from '../src/db/db.service';
import { dispatches } from '../src/db/schema';

describe('Rider Service (e2e)', () => {
  let app: INestMicroservice;
  let dbService: DbService;
  let controller: DispatchesController;

  const mockOrderReady = {
    orderId: '550e8400-e29b-41d4-a716-446655440000',
    customerName: 'John Doe',
    itemName: 'Pizza',
    quantity: 2,
    street: '123 Main St',
    area: 'Downtown',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DispatchesModule],
    }).compile();

    app = moduleFixture.createNestMicroservice({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 0 },
    });

    await app.listen();

    dbService = moduleFixture.get<DbService>(DbService);
    controller = moduleFixture.get<DispatchesController>(DispatchesController);
  });

  beforeEach(async () => {
    await dbService.db.delete(dispatches);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should save dispatch to database with correct fields', async () => {
    await controller.handle(mockOrderReady);

    const results = await dbService.db
      .select()
      .from(dispatches)
      .where(eq(dispatches.orderId, mockOrderReady.orderId));

    expect(results).toHaveLength(1);
    const dispatch = results[0];
    expect(dispatch.orderId).toBe(mockOrderReady.orderId);
    expect(dispatch.customerName).toBe(mockOrderReady.customerName);
    expect(dispatch.itemName).toBe(mockOrderReady.itemName);
    expect(dispatch.quantity).toBe(mockOrderReady.quantity);
    expect(dispatch.street).toBe(mockOrderReady.street);
    expect(dispatch.area).toBe(mockOrderReady.area);
    expect(dispatch.riderStatus).toBe('dispatched');
  });

  it('should default status to dispatched', async () => {
    await controller.handle(mockOrderReady);

    const results = await dbService.db
      .select()
      .from(dispatches)
      .where(eq(dispatches.orderId, mockOrderReady.orderId));

    expect(results[0].riderStatus).toBe('dispatched');
  });

  it('should handle multiple dispatches', async () => {
    await controller.handle(mockOrderReady);
    await controller.handle({
      ...mockOrderReady,
      orderId: '550e8400-e29b-41d4-a716-446655440001',
      itemName: 'Burger',
    });

    const allDispatches = await dbService.db.select().from(dispatches);
    expect(allDispatches).toHaveLength(2);
  });
});
