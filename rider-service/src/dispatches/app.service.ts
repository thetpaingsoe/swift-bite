import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { DbService } from '../db/db.service';
import { dispatches, type DispatchLine } from '../db/schema';

const RIDERS = ['Mike', 'Alex', 'Joe', 'Bright'];
@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    @Inject('ORDERS_SERVICE') private readonly ordersClient: ClientProxy,
    private readonly dbService: DbService,
  ) {}

  async dispatchRider(data: {
    orderId: string;
    customerName: string;
    lines: DispatchLine[];
    street: string;
    area: string;
    correlationId: string;
  }) {
    const rider = RIDERS[Math.floor(Math.random() * RIDERS.length)];

    let dispatch;
    try {
      [dispatch] = await this.dbService.db
        .insert(dispatches)
        .values({
          orderId: data.orderId,
          customerName: data.customerName,
          items: data.lines,
          street: data.street,
          area: data.area,
          riderStatus: 'dispatched',
          correlationId: data.correlationId,
        })
        .returning();
    } catch (error) {
      this.logger.error(
        `Failed to create dispatch for order ${data.orderId}`,
        error as Error,
      );
      throw error;
    }

    this.logger.log('dispatched save with ID : ', dispatch.orderId);
    const summary = data.lines
      .map((line) => `${line.quantity}x ${line.itemName}`)
      .join(', ');
    this.logger.log(rider + ' is on the way with ' + summary);

    try {
      await firstValueFrom(
        this.ordersClient
          .emit('order_dispatched', {
            orderId: data.orderId,
            riderName: rider,
            correlationId: data.correlationId,
          })
          .pipe(timeout(5000)),
      );
      this.logger.log('Event emitted to orders_queue (order dispatched)');
    } catch (error) {
      this.logger.error(
        `Dispatch ${dispatch.orderId} saved but could not notify orders`,
        error as Error,
      );
    }
  }
}
