import type { TicketLine } from './ticket-line.interface';

export interface OrderCreatedPayload {
  orderId: string;
  customerName: string;
  lines: TicketLine[];
  street: string;
  area: string;
  phone?: string | null;
  note?: string | null;
  correlationId?: string;
}
