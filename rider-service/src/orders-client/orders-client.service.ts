import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import type { OrderDispatchedPayload } from './interfaces/order-dispatched-payload.interface';

const EMIT_TIMEOUT_MS = 5000;

@Injectable()
export class OrdersClientService {
  private readonly logger = new Logger(OrdersClientService.name);

  constructor(@Inject('ORDERS_SERVICE') private readonly client: ClientProxy) {}

  async emitOrderDispatched(
    orderId: string,
    correlationId: string,
    riderName: string,
  ): Promise<void> {
    const payload: OrderDispatchedPayload = {
      orderId,
      riderName,
      correlationId,
    };
    try {
      await firstValueFrom(
        this.client.emit('order_dispatched', payload).pipe(timeout(EMIT_TIMEOUT_MS)),
      );
      this.logger.log('Event emitted to orders_queue (order dispatched)');
    } catch (error) {
      this.logger.error(
        `Dispatch ${orderId} saved but could not notify orders`,
        error as Error,
      );
    }
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }
}
