import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';

export interface TicketLine {
  menuItemId?: string;
  itemName: string;
  quantity: number;
}

export const tickets = pgTable('tickets', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').notNull(),
  customerName: varchar('customer_name', { length: 100 }).notNull(),
  items: jsonb('items').$type<TicketLine[]>().notNull(),
  street: varchar('street', { length: 255 }).notNull(),
  area: varchar('area', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('received'),
  correlationId: varchar('correlation_id', { length: 36 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
