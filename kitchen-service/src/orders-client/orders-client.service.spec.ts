import { of, throwError } from 'rxjs';
import { OrdersClientService } from './orders-client.service';

describe('OrdersClientService notifyOrders', () => {
  it('emits the status event with orderId and correlationId', async () => {
    const emit = jest.fn(() => of({}));
    const service = new OrdersClientService({ emit } as never);

    await service.notifyOrders('order_failed', 'order-1', 'corr-1');

    expect(emit).toHaveBeenCalledTimes(1);
    const [pattern, payload] = emit.mock.calls[0];
    expect(pattern).toBe('order_failed');
    expect(payload).toEqual({ orderId: 'order-1', correlationId: 'corr-1' });
  });

  it('swallows broker failures so ticket transitions never fail on notify', async () => {
    const emit = jest.fn(() => throwError(() => new Error('broker down')));
    const service = new OrdersClientService({ emit } as never);

    await expect(
      service.notifyOrders('order_failed', 'order-1', 'corr-1'),
    ).resolves.toBeUndefined();
  });
});
