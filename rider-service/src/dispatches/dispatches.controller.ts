import { Controller, Logger } from '@nestjs/common';
import { DispatchesService } from './dispatches.service';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import {
  correlationStorage,
  resolveCorrelationId,
} from '../correlation/correlation.storage';
import type { DispatchLine } from '../db/schema';
import {
  MAX_ATTEMPTS,
  RETRY_DELAY_MS,
  isRetryable,
  sleep,
} from '../rmq/rmq-retry';

interface OrderReadyPayload {
  orderId: string;
  customerName: string;
  lines: DispatchLine[];
  street: string;
  area: string;
  phone?: string | null;
  note?: string | null;
  correlationId?: string;
}

interface RmqChannel {
  ack(message: unknown): void;
  nack(message: unknown, allUpTo: boolean, requeue: boolean): void;
}

@Controller()
export class DispatchesController {
  private readonly logger = new Logger(DispatchesController.name);

  constructor(private readonly appService: DispatchesService) {}

  @EventPattern('order_ready')
  async handle(@Payload() data: OrderReadyPayload, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef() as RmqChannel;
    const message: unknown = context.getMessage();
    const orderId =
      typeof data?.orderId === 'string' ? data.orderId : 'unknown';
    try {
      this.assertOrderReadyPayload(data);
    } catch (error) {
      this.logger.error(
        `rider rejected order_ready for order ${orderId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      channel.nack(message, false, false);
      return;
    }
    const { correlationId, minted } = resolveCorrelationId(data.correlationId);
    if (minted) {
      this.logger.warn(
        `No correlationId in order_ready for order ${data.orderId}, minted ${correlationId}`,
      );
    }
    this.logger.log('Rider received dispatch for order : ' + data.orderId);

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        await correlationStorage.run({ correlationId }, () =>
          this.appService.dispatchRider({ ...data, correlationId }),
        );
        channel.ack(message);
        return;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        if (!isRetryable(error) || attempt === MAX_ATTEMPTS) {
          this.logger.error(
            `rider rejected order_ready for order ${orderId}: ${reason}`,
          );
          channel.nack(message, false, false);
          return;
        }
        this.logger.warn(
          `rider retrying order_ready for order ${orderId}: attempt ${attempt} failed (${reason})`,
        );
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  private assertOrderReadyPayload(
    data: unknown,
  ): asserts data is OrderReadyPayload {
    const payload = data as Partial<OrderReadyPayload> | null | undefined;
    if (
      !payload ||
      typeof payload.orderId !== 'string' ||
      payload.orderId.length === 0
    ) {
      throw new Error('order_ready payload missing orderId');
    }
    if (
      typeof payload.customerName !== 'string' ||
      payload.customerName.length === 0
    ) {
      throw new Error(
        `order_ready payload missing customerName for order ${payload.orderId}`,
      );
    }
    if (!Array.isArray(payload.lines)) {
      throw new Error(
        `order_ready payload missing lines for order ${payload.orderId}`,
      );
    }
    payload.lines.forEach((line, index) => {
      const entry = line as Partial<DispatchLine> | null | undefined;
      if (
        !entry ||
        typeof entry.itemName !== 'string' ||
        entry.itemName.length === 0
      ) {
        throw new Error(
          `order_ready payload has invalid itemName at lines[${index}] for order ${payload.orderId}`,
        );
      }
      if (
        typeof entry.quantity !== 'number' ||
        !Number.isFinite(entry.quantity) ||
        entry.quantity < 1
      ) {
        throw new Error(
          `order_ready payload has invalid quantity at lines[${index}] for order ${payload.orderId}`,
        );
      }
    });
    if (typeof payload.street !== 'string' || payload.street.length === 0) {
      throw new Error(
        `order_ready payload missing street for order ${payload.orderId}`,
      );
    }
    if (typeof payload.area !== 'string' || payload.area.length === 0) {
      throw new Error(
        `order_ready payload missing area for order ${payload.orderId}`,
      );
    }
  }
}
