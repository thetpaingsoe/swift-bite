import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { tickets } from '../db/schema';
import type { TicketLine } from './interfaces/ticket-line.interface';
import { RiderClientService } from '../rider-client/rider-client.service';
import { OrdersClientService } from '../orders-client/orders-client.service';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly riderClient: RiderClientService,
    private readonly ordersClient: OrdersClientService,
    private readonly dbService: DbService,
  ) {}

  async createTicket(data: {
    orderId: string;
    customerName: string;
    lines: TicketLine[];
    street: string;
    area: string;
    phone?: string | null;
    note?: string | null;
    correlationId: string;
  }) {
    const [existing] = await this.dbService.db
      .select()
      .from(tickets)
      .where(eq(tickets.orderId, data.orderId))
      .limit(1);
    if (existing) {
      this.logger.log(
        `Duplicate order_created for order ${data.orderId}, ticket ${existing.id} already exists`,
      );
      return existing;
    }
    try {
      const [ticket] = await this.dbService.db
        .insert(tickets)
        .values({
          orderId: data.orderId,
          customerName: data.customerName,
          items: data.lines,
          street: data.street,
          area: data.area,
          phone: data.phone ?? null,
          note: data.note ?? null,
          status: 'received',
          correlationId: data.correlationId,
        })
        .returning();
      this.logger.log('Ticket saved to kitchen DB : ' + ticket.id);
      return ticket;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const [raced] = await this.dbService.db
          .select()
          .from(tickets)
          .where(eq(tickets.orderId, data.orderId))
          .limit(1);
        if (raced) {
          this.logger.log(
            `Duplicate order_created for order ${data.orderId}, ticket ${raced.id} already exists`,
          );
          return raced;
        }
      }
      this.logger.error(
        `Failed to create ticket for order ${data.orderId}`,
        error as Error,
      );
      throw error;
    }
  }

  async listTickets(status?: string) {
    const query = this.dbService.db.select().from(tickets);
    const rows = status
      ? await query.where(eq(tickets.status, status)).orderBy(asc(tickets.createdAt))
      : await query.orderBy(asc(tickets.createdAt));
    return rows;
  }

  async getTicket(id: string) {
    const [ticket] = await this.dbService.db
      .select()
      .from(tickets)
      .where(eq(tickets.id, id))
      .limit(1);

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }
    return ticket;
  }

  async acceptTicket(id: string) {
    const ticket = await this.requireStatus(id, ['received']);
    const [updated] = await this.dbService.db
      .update(tickets)
      .set({ status: 'cooking' })
      .where(eq(tickets.id, id))
      .returning();

    this.logger.log(`Ticket ${id} accepted (cooking)`);
    await this.notifyOrders('order_cooking', ticket.orderId, ticket.correlationId);
    return updated;
  }

  async completeTicket(id: string) {
    const ticket = await this.requireStatus(id, ['cooking']);
    const [updated] = await this.dbService.db
      .update(tickets)
      .set({ status: 'ready' })
      .where(eq(tickets.id, id))
      .returning();

    this.logger.log(`Ticket ${id} completed (ready)`);

    try {
      await this.riderClient.emitOrderReady(ticket);
      this.logger.log('Event emitted to rider_queue (order ready)');
    } catch (error) {
      this.logger.error(
        `Ticket ${id} ready but could not notify rider`,
        error as Error,
      );
    }

    await this.notifyOrders('order_ready', ticket.orderId, ticket.correlationId);
    return updated;
  }

  async failTicket(orderId: string, correlationId: string) {
    await this.notifyOrders('order_failed', orderId, correlationId);
  }

  async rejectTicket(id: string) {
    const ticket = await this.requireStatus(id, ['received', 'cooking']);
    const [updated] = await this.dbService.db
      .update(tickets)
      .set({ status: 'rejected' })
      .where(eq(tickets.id, id))
      .returning();

    this.logger.log(`Ticket ${id} rejected`);
    await this.notifyOrders('order_failed', ticket.orderId, ticket.correlationId);
    return updated;
  }

  private async requireStatus(id: string, allowed: string[]) {
    const ticket = await this.getTicket(id);
    if (!allowed.includes(ticket.status)) {
      throw new ConflictException(
        `Ticket is ${ticket.status}, action requires ${allowed.join(' or ')}`,
      );
    }
    return ticket;
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const record = error as { code?: unknown; message?: unknown };
    return (
      record.code === '23505' ||
      (typeof record.message === 'string' &&
        record.message.includes('tickets_order_id_unique'))
    );
  }

  private async notifyOrders(
    event: string,
    orderId: string,
    correlationId: string | null,
  ) {
    await this.ordersClient.notifyOrders(event, orderId, correlationId);
  }
}
