import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

const EMIT_TIMEOUT_MS = 5000;

@Injectable()
export class OrdersClientService {
  private readonly logger = new Logger(OrdersClientService.name);

  constructor(@Inject('ORDERS_SERVICE') private readonly client: ClientProxy) {}

  async notifyOrders(
    event: string,
    orderId: string,
    correlationId: string | null,
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.client
          .emit(event, { orderId, correlationId })
          .pipe(timeout(EMIT_TIMEOUT_MS)),
      );
      this.logger.log(
        `Event emitted to orders_queue (${event}) for order ${orderId}`,
      );
    } catch (error) {
      this.logger.error(
        `Ticket for order ${orderId} could not notify orders (${event})`,
        error as Error,
      );
    }
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }
}
