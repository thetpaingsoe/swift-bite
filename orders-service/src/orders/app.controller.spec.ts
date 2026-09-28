import type { RmqContext } from '@nestjs/microservices';
import { AppController } from './app.controller';
import type { AppService } from './app.service';

function makeContext(channel: unknown, message: unknown): RmqContext {
  return {
    getChannelRef: () => channel,
    getMessage: () => message,
  } as unknown as RmqContext;
}

describe('AppController status events ack/nack', () => {
  const message = { deliveryTag: 1 };
  const payload = { orderId: 'order-1', correlationId: 'corr-1' };
  let appService: { updateStatus: jest.Mock };
  let controller: AppController;
  let channel: { ack: jest.Mock; nack: jest.Mock };

  beforeEach(() => {
    appService = { updateStatus: jest.fn().mockResolvedValue({}) };
    controller = new AppController(appService as unknown as AppService);
    channel = { ack: jest.fn(), nack: jest.fn() };
  });

  it('acks a valid status event', async () => {
    await controller.handleOrderFailed(payload, makeContext(channel, message));

    expect(appService.updateStatus).toHaveBeenCalledWith(
      'order-1',
      'cancelled',
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('drops payloads missing orderId without calling the service', async () => {
    await controller.handleOrderReady(
      {} as never,
      makeContext(channel, message),
    );

    expect(appService.updateStatus).not.toHaveBeenCalled();
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });

  it('retries a transient failure then acks', async () => {
    const transient = Object.assign(new Error('connection refused'), {
      code: 'ECONNREFUSED',
    });
    appService.updateStatus
      .mockRejectedValueOnce(transient)
      .mockResolvedValueOnce({});

    await controller.handleOrderCooking(payload, makeContext(channel, message));

    expect(appService.updateStatus).toHaveBeenCalledTimes(2);
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('drops into the nack path after max retries', async () => {
    const transient = Object.assign(new Error('connection refused'), {
      code: 'ECONNREFUSED',
    });
    appService.updateStatus.mockRejectedValue(transient);

    await controller.handleOrderDispatched(
      payload,
      makeContext(channel, message),
    );

    expect(appService.updateStatus).toHaveBeenCalledTimes(3);
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });

  it('sends a DB failure straight to the nack path with a single attempt', async () => {
    appService.updateStatus.mockRejectedValue(new Error('db down'));

    await controller.handleOrderFailed(payload, makeContext(channel, message));

    expect(appService.updateStatus).toHaveBeenCalledTimes(1);
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });
});
