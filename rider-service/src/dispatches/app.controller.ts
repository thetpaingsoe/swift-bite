import { Controller, Logger } from '@nestjs/common';
import { AppService } from './app.service';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  correlationStorage,
  resolveCorrelationId,
} from '../correlation/correlation.storage';
import type { DispatchLine } from '../db/schema';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) {}

  @EventPattern('order_ready')
  async handle(
    @Payload()
    data: {
      orderId: string;
      customerName: string;
      lines: DispatchLine[];
      street: string;
      area: string;
      phone?: string | null;
      note?: string | null;
      correlationId?: string;
    },
  ) {
    const { correlationId, minted } = resolveCorrelationId(
      data.correlationId,
    );
    if (minted) {
      this.logger.warn(
        `No correlationId in order_ready for order ${data.orderId}, minted ${correlationId}`,
      );
    }
    this.logger.log('Rider received dispatch for order : ' + data.orderId);

    await correlationStorage.run({ correlationId }, () =>
      this.appService.dispatchRider({ ...data, correlationId }),
    );
  }
}
