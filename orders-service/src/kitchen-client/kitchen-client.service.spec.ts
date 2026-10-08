import { of, throwError } from 'rxjs';
import { KitchenClientService } from './kitchen-client.service';

describe('KitchenClientService order_created payload', () => {
  const order = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    customerName: 'John Doe',
    street: '123 Main St',
    area: 'Downtown',
    phone: '+959123456789',
    note: 'Ring twice',
  } as never;
  const lines = [{ menuItemId: 'item-1', itemName: 'Pizza', quantity: 2 }];
  const correlationId = 'corr-1';

  function buildClient(emit: jest.Mock) {
    return { emit, connect: jest.fn() };
  }

  it('emits order_created with the full order snapshot', async () => {
    const emit = jest.fn(() => of({}));
    const service = new KitchenClientService(buildClient(emit) as never);

    await service.emitOrderCreated(order, lines, correlationId);

    expect(emit).toHaveBeenCalledTimes(1);
    const [pattern, payload] = emit.mock.calls[0];
    expect(pattern).toBe('order_created');
    expect(payload).toEqual({
      orderId: order.id,
      customerName: 'John Doe',
      lines: [{ menuItemId: 'item-1', itemName: 'Pizza', quantity: 2 }],
      street: '123 Main St',
      area: 'Downtown',
      phone: '+959123456789',
      note: 'Ring twice',
      correlationId: 'corr-1',
    });
  });

  it('propagates broker failures so the caller can flag the order unsent', async () => {
    const emit = jest.fn(() => throwError(() => new Error('broker down')));
    const service = new KitchenClientService(buildClient(emit) as never);

    await expect(
      service.emitOrderCreated(order, lines, correlationId),
    ).rejects.toThrow('broker down');
  });
});
