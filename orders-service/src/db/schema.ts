import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  numeric,
} from 'drizzle-orm/pg-core';

export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id'),
  customerName: varchar('customer_name', { length: 100 }).notNull(),
  totalPrice: numeric('total_price').notNull(),
  street: varchar('street', { length: 255 }).notNull(),
  area: varchar('area', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  correlationId: varchar('correlation_id', { length: 36 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

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

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
