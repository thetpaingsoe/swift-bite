import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { TicketLine } from '../tickets/interfaces/ticket-line.interface';

export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id').notNull(),
    customerName: varchar('customer_name', { length: 100 }).notNull(),
    items: jsonb('items').$type<TicketLine[]>().notNull(),
    street: varchar('street', { length: 255 }).notNull(),
    area: varchar('area', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 30 }),
    note: varchar('note', { length: 255 }),
    status: varchar('status', { length: 50 }).notNull().default('received'),
    correlationId: varchar('correlation_id', { length: 36 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex('tickets_order_id_unique').on(t.orderId)],
);

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
