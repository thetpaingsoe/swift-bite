import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { dispatches } from '../db/schema';
import type { DispatchLine } from './interfaces/dispatch-line.interface';
import { OrdersClientService } from '../orders-client/orders-client.service';

const RIDERS = ['Mike', 'Alex', 'Joe', 'Bright'];
@Injectable()
export class DispatchesService {
  private readonly logger = new Logger(DispatchesService.name);

  constructor(
    private readonly ordersClient: OrdersClientService,
    private readonly dbService: DbService,
  ) {}

  async dispatchRider(data: {
    orderId: string;
    customerName: string;
    lines: DispatchLine[];
    street: string;
    area: string;
    phone?: string | null;
    note?: string | null;
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
          phone: data.phone ?? null,
          note: data.note ?? null,
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

    await this.ordersClient.emitOrderDispatched(
      data.orderId,
      data.correlationId,
      rider,
    );
  }
}
