import { of, throwError } from 'rxjs';
import { RiderClientService } from './rider-client.service';

describe('RiderClientService order_ready payload', () => {
  const ticket = {
    orderId: '550e8400-e29b-41d4-a716-446655440000',
    customerName: 'John Doe',
    items: [{ itemName: 'Pizza', quantity: 2 }],
    street: '123 Main St',
    area: 'Downtown',
    phone: '+959123456789',
    note: 'Ring twice',
    correlationId: 'corr-1',
  } as never;

  it('emits order_ready with the ticket snapshot', async () => {
    const emit = jest.fn(() => of({}));
    const service = new RiderClientService({ emit } as never);

    await service.emitOrderReady(ticket);

    expect(emit).toHaveBeenCalledTimes(1);
    const [pattern, payload] = emit.mock.calls[0];
    expect(pattern).toBe('order_ready');
    expect(payload).toEqual({
      orderId: '550e8400-e29b-41d4-a716-446655440000',
      customerName: 'John Doe',
      lines: [{ itemName: 'Pizza', quantity: 2 }],
      street: '123 Main St',
      area: 'Downtown',
      phone: '+959123456789',
      note: 'Ring twice',
      correlationId: 'corr-1',
    });
  });

  it('propagates broker failures so the caller can log the miss', async () => {
    const emit = jest.fn(() => throwError(() => new Error('broker down')));
    const service = new RiderClientService({ emit } as never);

    await expect(service.emitOrderReady(ticket)).rejects.toThrow(
      'broker down',
    );
  });
});
