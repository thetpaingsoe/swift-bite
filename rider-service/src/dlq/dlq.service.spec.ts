import { Logger } from '@nestjs/common';
import type { ConsumeMessage } from 'amqplib';
import { DlqService, RIDER_DLQ } from './dlq.service';

function makeMessage(content: string): ConsumeMessage {
  return { content: Buffer.from(content) } as unknown as ConsumeMessage;
}

describe('DlqService', () => {
  const config = {
    get: (key: string, fallback?: string) =>
      key === 'RABBITMQ_URL'
        ? 'amqp://guest:guest@localhost:5672'
        : (process.env[key] ?? fallback),
  };

  let service: DlqService;
  let errorSpy: jest.SpyInstance;
  let channel: { ack: jest.Mock };

  function errorLine(): string {
    const call = errorSpy.mock.calls[0] as unknown[];
    const first: unknown = call[0];
    return typeof first === 'string' ? first : JSON.stringify(first);
  }

  beforeEach(() => {
    service = new DlqService(config as never);
    const logger = (service as unknown as { logger: Logger }).logger;
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    jest.spyOn(logger, 'log').mockImplementation(() => undefined);
    channel = { ack: jest.fn() };
  });

  it('logs payload plus correlationId at error level and acks', () => {
    const data = { orderId: 'order-9', correlationId: 'corr-9' };
    service.handleMessage(
      channel,
      makeMessage(JSON.stringify({ pattern: 'order_ready', data })),
    );

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = errorLine();
    expect(line).toContain('DLQ ALERT');
    expect(line).toContain(RIDER_DLQ);
    expect(line).toContain('corr-9');
    expect(line).toContain('order-9');
    expect(channel.ack).toHaveBeenCalledTimes(1);
  });

  it('acks unparseable messages after logging them', () => {
    service.handleMessage(channel, makeMessage('not-json{{{'));

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorLine()).toContain('correlationId=missing');
    expect(channel.ack).toHaveBeenCalledTimes(1);
  });

  it('acks envelopes without a correlationId and marks it missing', () => {
    service.handleMessage(
      channel,
      makeMessage(JSON.stringify({ pattern: 'order_ready', data: {} })),
    );

    expect(errorLine()).toContain('correlationId=missing');
    expect(channel.ack).toHaveBeenCalledTimes(1);
  });

  it('truncates huge payloads in the alert log', () => {
    const big = 'x'.repeat(5000);
    service.handleMessage(
      channel,
      makeMessage(
        JSON.stringify({
          pattern: 'order_ready',
          data: { orderId: 'order-9', correlationId: 'corr-9', big },
        }),
      ),
    );

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = errorLine();
    expect(line).toContain('DLQ ALERT');
    expect(line.length).toBeLessThan(3000);
    expect(line).toContain('chars total');
    expect(channel.ack).toHaveBeenCalledTimes(1);
  });

  it('ignores null messages without touching the channel', () => {
    expect(() => service.handleMessage(channel, null)).not.toThrow();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(channel.ack).not.toHaveBeenCalled();
  });
});
