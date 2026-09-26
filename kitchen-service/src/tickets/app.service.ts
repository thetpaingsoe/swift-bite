import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { asc, eq } from 'drizzle-orm';
import { firstValueFrom, timeout } from 'rxjs';
import { DbService } from '../db/db.service';
import { tickets, type TicketLine } from '../db/schema';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    @Inject('RIDER_SERVICE') private readonly riderClient: ClientProxy,
    @Inject('ORDERS_SERVICE') private readonly ordersClient: ClientProxy,
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
      await firstValueFrom(
        this.riderClient
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
          .pipe(timeout(5000)),
      );
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

  private async notifyOrders(
    event: string,
    orderId: string,
    correlationId: string | null,
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
