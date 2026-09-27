import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AmqpConnectionManager,
  ChannelWrapper,
  connect,
} from 'amqp-connection-manager';
import type { Channel, ConsumeMessage } from 'amqplib';

export const RIDER_DLQ = 'rider_queue.dlq';

interface DlqEnvelope {
  pattern?: unknown;
  data?: unknown;
}

interface AckChannel {
  ack(message: ConsumeMessage): void;
}

@Injectable()
export class DlqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DlqService.name);
  private connection?: AmqpConnectionManager;
  private channelWrapper?: ChannelWrapper;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const url = this.configService.get<string>('RABBITMQ_URL')!;
    const durable = this.configService.get<string>('NODE_ENV') === 'production';
    this.connection = connect([url]);
    this.channelWrapper = this.connection.createChannel({
      setup: (channel: Channel) =>
        channel
          .assertQueue(RIDER_DLQ, { durable })
          .then(() => channel.prefetch(1))
          .then(() =>
            channel.consume(
              RIDER_DLQ,
              (msg) => this.handleMessage(channel, msg),
              { noAck: false },
            ),
          ),
    });
  }

  handleMessage(channel: AckChannel, msg: ConsumeMessage | null) {
    if (!msg) {
      return;
    }
    const raw = msg.content.toString();
    let envelope: DlqEnvelope;
    try {
      envelope = JSON.parse(raw) as DlqEnvelope;
    } catch {
      this.logger.error(
        `DLQ ALERT ${RIDER_DLQ} correlationId=missing payload=${this.truncate(raw)}`,
      );
      channel.ack(msg);
      return;
    }
    const data =
      envelope.data && typeof envelope.data === 'object'
        ? (envelope.data as Record<string, unknown>)
        : {};
    const correlationId =
      typeof data.correlationId === 'string' && data.correlationId.length > 0
        ? data.correlationId
        : 'missing';
    const pattern =
      typeof envelope.pattern === 'string'
        ? envelope.pattern
        : JSON.stringify(envelope.pattern ?? 'unknown');
    const payload = this.truncate(JSON.stringify(envelope.data ?? raw));
    this.logger.error(
      `DLQ ALERT ${RIDER_DLQ} pattern=${pattern} correlationId=${correlationId} payload=${payload}`,
    );
    channel.ack(msg);
  }

  private truncate(text: string): string {
    if (text.length <= 2000) {
      return text;
    }
    return `${text.slice(0, 2000)}…(${text.length} chars total)`;
  }

  async onModuleDestroy() {
    await this.channelWrapper?.close();
    await this.connection?.close();
  }
}
