import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 30 }),
  role: varchar('role', { length: 20 }).notNull().default('customer'),
  createdAt: timestamp('created_at').defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const addresses = pgTable('addresses', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 50 }).notNull(),
  street: varchar('street', { length: 255 }).notNull(),
  area: varchar('area', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;
