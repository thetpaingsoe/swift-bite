import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { DbService } from '../db/db.service';
import { tickets } from '../db/schema';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    @Inject('RIDER_SERVICE') private readonly riderClient: ClientProxy,
    @Inject('ORDERS_SERVICE') private readonly ordersClient: ClientProxy,
    private readonly dbService: DbService,
  ) {}

  async processOrder(data: {
    orderId: string;
    customerName: string;
    itemName: string;
    quantity: number;
    street: string;
    area: string;
    correlationId: string;
  }) {
    let ticket;
    try {
      [ticket] = await this.dbService.db
        .insert(tickets)
        .values({
          orderId: data.orderId,
          customerName: data.customerName,
          itemName: data.itemName,
          quantity: data.quantity,
          street: data.street,
          area: data.area,
          status: 'received',
          correlationId: data.correlationId,
        })
        .returning();
    } catch (error) {
      this.logger.error(
        `Failed to create ticket for order ${data.orderId}`,
        error as Error,
      );
      throw error;
    }

    this.logger.log('Ticket saved to kitchen DB : ' + ticket.id);

    await this.notifyOrders('order_cooking', data.orderId, data.correlationId);

    await new Promise((res) => setTimeout(res, 2000));

    try {
      await firstValueFrom(
        this.riderClient
          .emit('order_ready', {
            orderId: data.orderId,
            customerName: data.customerName,
            itemName: data.itemName,
            quantity: data.quantity,
            street: data.street,
            area: data.area,
            correlationId: data.correlationId,
          })
          .pipe(timeout(5000)),
      );
      this.logger.log('Event emitted to rider_queue (order ready)');
      await this.notifyOrders('order_ready', data.orderId, data.correlationId);
    } catch (error) {
      this.logger.error(
        `Ticket ${ticket.id} created but could not notify rider`,
        error as Error,
      );
    }
  }

  private async notifyOrders(
    event: string,
    orderId: string,
    correlationId: string,
  ) {
    try {
      await firstValueFrom(
        this.ordersClient
          .emit(event, { orderId, correlationId })
          .pipe(timeout(5000)),
      );
      this.logger.log(`Event emitted to orders_queue (${event})`);
    } catch (error) {
      this.logger.error(
        `Ticket for order ${orderId} could not notify orders (${event})`,
        error as Error,
      );
    }
  }
}
