import { Controller, Logger } from '@nestjs/common';
import { AppService } from './app.service';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  correlationStorage,
  resolveCorrelationId,
} from '../correlation/correlation.storage';
import type { TicketLine } from '../db/schema';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) {}

  @EventPattern('order_created')
  async handleOrderCreated(
    @Payload()
    data: {
      orderId: string;
      customerName: string;
      lines: TicketLine[];
      street: string;
      area: string;
      correlationId?: string;
    },
  ) {
    const { correlationId, minted } = resolveCorrelationId(
      data.correlationId,
    );
    if (minted) {
      this.logger.warn(
        `No correlationId in order_created for order ${data.orderId}, minted ${correlationId}`,
      );
    }
    this.logger.log('kitchen received order: ' + data.orderId);

    await correlationStorage.run({ correlationId }, () =>
      this.appService.processOrder({ ...data, correlationId }),
    );
  }
}
