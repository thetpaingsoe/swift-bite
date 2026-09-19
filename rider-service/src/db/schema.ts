import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';

export interface DispatchLine {
  menuItemId?: string;
  itemName: string;
  quantity: number;
}

export const dispatches = pgTable('dispatches', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').notNull(),
  customerName: varchar('customer_name', { length: 100 }).notNull(),
  items: jsonb('items').$type<DispatchLine[]>().notNull(),
  street: varchar('street', { length: 255 }).notNull(),
  area: varchar('area', { length: 255 }).notNull(),
  riderStatus: varchar('status', { length: 50 })
    .notNull()
    .default('dispatched'),
  correlationId: varchar('correlation_id', { length: 36 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type Dispatch = typeof dispatches.$inferSelect;
export type NewDispatch = typeof dispatches.$inferInsert;
