import type { RmqContext } from '@nestjs/microservices';
import { AppController } from './app.controller';
import type { AppService } from './app.service';

const validPayload = {
  orderId: '550e8400-e29b-41d4-a716-446655440000',
  customerName: 'John Doe',
  lines: [{ itemName: 'Pizza', quantity: 2 }],
  street: '123 Main St',
  area: 'Downtown',
  correlationId: 'corr-1',
};

function makeContext(channel: unknown, message: unknown): RmqContext {
  return {
    getChannelRef: () => channel,
    getMessage: () => message,
  } as unknown as RmqContext;
}

describe('AppController order_ready ack/nack', () => {
  const message = { deliveryTag: 1 };
  let appService: { dispatchRider: jest.Mock };
  let controller: AppController;
  let channel: { ack: jest.Mock; nack: jest.Mock };

  beforeEach(() => {
    appService = { dispatchRider: jest.fn().mockResolvedValue(undefined) };
    controller = new AppController(appService as unknown as AppService);
    channel = { ack: jest.fn(), nack: jest.fn() };
  });

  it('acks a valid message after the dispatch is created', async () => {
    await controller.handle(validPayload, makeContext(channel, message));

    expect(appService.dispatchRider).toHaveBeenCalledTimes(1);
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('nacks without requeue when dispatch fails', async () => {
    appService.dispatchRider.mockRejectedValue(new Error('db down'));

    await controller.handle(validPayload, makeContext(channel, message));

    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });

  it('nacks malformed payloads without calling the service', async () => {
    await controller.handle(
      { nonsense: true } as never,
      makeContext(channel, message),
    );

    expect(appService.dispatchRider).not.toHaveBeenCalled();
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });

  it('nacks payloads with bad line content without calling the service', async () => {
    await controller.handle(
      { ...validPayload, lines: [{ itemName: 'Pizza', quantity: 0 }] },
      makeContext(channel, message),
    );

    expect(appService.dispatchRider).not.toHaveBeenCalled();
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });

  it('retries a transient failure then acks', async () => {
    const transient = Object.assign(new Error('connection refused'), {
      code: 'ECONNREFUSED',
    });
    appService.dispatchRider
      .mockRejectedValueOnce(transient)
      .mockResolvedValueOnce(undefined);

    await controller.handle(validPayload, makeContext(channel, message));

    expect(appService.dispatchRider).toHaveBeenCalledTimes(2);
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('rejects into the DLQ after max retries', async () => {
    const transient = Object.assign(new Error('connection refused'), {
      code: 'ECONNREFUSED',
    });
    appService.dispatchRider.mockRejectedValue(transient);

    await controller.handle(validPayload, makeContext(channel, message));

    expect(appService.dispatchRider).toHaveBeenCalledTimes(3);
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });

  it('sends a DB failure straight to the DLQ with a single write attempt', async () => {
    appService.dispatchRider.mockRejectedValue(new Error('db down'));

    await controller.handle(validPayload, makeContext(channel, message));

    expect(appService.dispatchRider).toHaveBeenCalledTimes(1);
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });
});
