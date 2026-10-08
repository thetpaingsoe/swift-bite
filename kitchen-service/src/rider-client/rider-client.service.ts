import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import type { Ticket } from '../db/schema';

const EMIT_TIMEOUT_MS = 5000;

@Injectable()
export class RiderClientService {
  constructor(@Inject('RIDER_SERVICE') private readonly client: ClientProxy) {}

  async emitOrderReady(ticket: Ticket): Promise<void> {
    await firstValueFrom(
      this.client
        .emit('order_ready', {
          orderId: ticket.orderId,
          customerName: ticket.customerName,
          lines: ticket.items,
          street: ticket.street,
          area: ticket.area,
          phone: ticket.phone,
          note: ticket.note,
          correlationId: ticket.correlationId,
        })
        .pipe(timeout(EMIT_TIMEOUT_MS)),
    );
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }
}
