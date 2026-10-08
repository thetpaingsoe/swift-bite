import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import type { Order } from '../db/schema';

export interface OrderCreatedLine {
  menuItemId: string;
  itemName: string;
  quantity: number;
}

export interface OrderCreatedPayload {
  orderId: string;
  customerName: string;
  lines: OrderCreatedLine[];
  street: string;
  area: string;
  phone: string | null;
  note: string | null;
  correlationId: string;
}

const EMIT_TIMEOUT_MS = 5000;

@Injectable()
export class KitchenClientService {
  constructor(
    @Inject('KITCHEN_SERVICE') private readonly client: ClientProxy,
  ) {}

  async emitOrderCreated(
    order: Order,
    lines: OrderCreatedLine[],
    correlationId: string,
  ): Promise<void> {
    const payload: OrderCreatedPayload = {
      orderId: order.id,
      customerName: order.customerName,
      lines: lines.map(({ menuItemId, itemName, quantity }) => ({
        menuItemId,
        itemName,
        quantity,
      })),
      street: order.street,
      area: order.area,
      phone: order.phone,
      note: order.note,
      correlationId,
    };
    await firstValueFrom(
      this.client.emit('order_created', payload).pipe(timeout(EMIT_TIMEOUT_MS)),
    );
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }
}
