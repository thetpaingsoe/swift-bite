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

describe('AppController order_created ack/nack', () => {
  const message = { deliveryTag: 1 };
  let appService: { createTicket: jest.Mock; failTicket: jest.Mock };
  let controller: AppController;
  let channel: { ack: jest.Mock; nack: jest.Mock };

  beforeEach(() => {
    appService = {
      createTicket: jest.fn().mockResolvedValue({ id: 't-1' }),
      failTicket: jest.fn().mockResolvedValue(undefined),
    };
    controller = new AppController(appService as unknown as AppService);
    channel = { ack: jest.fn(), nack: jest.fn() };
  });

  it('acks a valid message after the ticket is created', async () => {
    await controller.handleOrderCreated(
      validPayload,
      makeContext(channel, message),
    );

    expect(appService.createTicket).toHaveBeenCalledTimes(1);
    expect(appService.failTicket).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('nacks without requeue and compensates when ticket creation fails', async () => {
    appService.createTicket.mockRejectedValue(new Error('db down'));

    await controller.handleOrderCreated(
      validPayload,
      makeContext(channel, message),
    );

    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    expect(appService.failTicket).toHaveBeenCalledWith(
      validPayload.orderId,
      validPayload.correlationId,
    );
  });

  it('nacks malformed payloads without calling the service or compensating', async () => {
    await controller.handleOrderCreated(
      { nonsense: true } as never,
      makeContext(channel, message),
    );

    expect(appService.createTicket).not.toHaveBeenCalled();
    expect(appService.failTicket).not.toHaveBeenCalled();
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });

  it('nacks payloads with bad line content without compensating', async () => {
    await controller.handleOrderCreated(
      { ...validPayload, lines: [{ quantity: 2 }] } as never,
      makeContext(channel, message),
    );

    expect(appService.createTicket).not.toHaveBeenCalled();
    expect(appService.failTicket).not.toHaveBeenCalled();
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });
});
