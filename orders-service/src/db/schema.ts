import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  numeric,
  boolean,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id'),
    customerName: varchar('customer_name', { length: 100 }).notNull(),
    subtotal: numeric('subtotal').notNull().default('0'),
    fee: numeric('fee').notNull().default('0'),
    tax: numeric('tax').notNull().default('0'),
    totalPrice: numeric('total_price').notNull(),
    street: varchar('street', { length: 255 }).notNull(),
    area: varchar('area', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 30 }),
    note: varchar('note', { length: 255 }),
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    paymentStatus: varchar('payment_status', { length: 20 })
      .notNull()
      .default('pending'),
    paymentIntentId: varchar('payment_intent_id', { length: 255 }),
    readyAt: timestamp('ready_at', { withTimezone: true }),
    kitchenNotified: boolean('kitchen_notified'),
    correlationId: varchar('correlation_id', { length: 36 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('orders_status_ready_at_idx').on(t.status, t.readyAt),
    uniqueIndex('orders_payment_intent_id_idx').on(t.paymentIntentId),
    check(
      'orders_payment_status_check',
      sql`${t.paymentStatus} in ('pending', 'paid', 'failed', 'refunded')`,
    ),
  ],
);

export const orderItems = pgTable('order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  menuItemId: uuid('menu_item_id').notNull(),
  itemName: varchar('item_name', { length: 255 }).notNull(),
  itemPrice: numeric('item_price').notNull(),
  quantity: integer('quantity').notNull(),
});

export const orderEvents = pgTable(
  'order_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 50 }).notNull(),
    note: varchar('note', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('order_events_order_id_created_at_idx').on(t.orderId, t.createdAt),
    check(
      'order_events_status_check',
      sql`${t.status} in ('pending', 'cooking', 'ready', 'dispatched', 'cancelled', 'needs_review')`,
    ),
  ],
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type OrderEvent = typeof orderEvents.$inferSelect;
export type NewOrderEvent = typeof orderEvents.$inferInsert;
