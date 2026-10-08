import { of, throwError } from 'rxjs';
import { OrdersClientService } from './orders-client.service';

describe('OrdersClientService order_dispatched payload', () => {
  it('emits order_dispatched with orderId, riderName, and correlationId only', async () => {
    const emit = jest.fn(() => of({}));
    const service = new OrdersClientService({ emit } as never);

    await service.emitOrderDispatched('order-1', 'corr-1', 'Mike');

    expect(emit).toHaveBeenCalledTimes(1);
    const [pattern, payload] = emit.mock.calls[0];
    expect(pattern).toBe('order_dispatched');
    expect(payload).toEqual({
      orderId: 'order-1',
      riderName: 'Mike',
      correlationId: 'corr-1',
    });
  });

  it('swallows broker failures so the saved dispatch never fails on notify', async () => {
    const emit = jest.fn(() => throwError(() => new Error('broker down')));
    const service = new OrdersClientService({ emit } as never);

    await expect(
      service.emitOrderDispatched('order-1', 'corr-1', 'Mike'),
    ).resolves.toBeUndefined();
  });
});
