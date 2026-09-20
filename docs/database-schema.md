# Database Schema

Each service owns its own database. No cross-service direct DB access.

## auth-service — `users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | default `gen_random_uuid()` |
| `name` | varchar(100) | not null |
| `email` | varchar(255) | not null, unique |
| `password_hash` | varchar(255) | bcrypt hashed, not null |
| `role` | varchar(20) | not null, default `customer`; one of `admin`, `kitchen`, `rider`, `customer` |
| `created_at` | timestamp | default now() |

The role is embedded in the JWT at login and enforced by downstream guards.
Registration always creates `customer`; staff roles are assigned directly or via seeder.

## item-service — `categories` + `menu_items`

### `categories`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | default `gen_random_uuid()` |
| `name` | varchar(100) | not null, unique ('Food', 'Drinks') |
| `created_at` | timestamp | default now() |

### `menu_items`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | default `gen_random_uuid()` |
| `name` | varchar(255) | not null |
| `description` | text | not null |
| `price` | numeric | not null, decimal prices allowed (e.g. 9.50) |
| `category_id` | uuid FK | not null, references `categories.id` with cascade delete |
| `image_url` | varchar(500) | not null, URL to stock photo |
| `available` | boolean | default true |
| `created_at` | timestamp | default now() |

**Seed data:** check `item-service/src/db/seed.ts` for the current menu.

## orders-service — `orders` + `order_items`

One checkout is one order. The header carries totals and status, the lines carry items.

### `orders`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | default `gen_random_uuid()` |
| `user_id` | uuid | nullable (NULL on pre-guard rows), owner of the order |
| `customer_name` | varchar(100) | not null |
| `total_price` | numeric | not null, sum of line totals, calculated by backend |
| `street` | varchar(255) | not null, delivery address |
| `area` | varchar(255) | not null, delivery area/ward |
| `status` | varchar(50) | not null, default `pending`; see lifecycle below |
| `correlation_id` | varchar(36) | nullable, end-to-end trace ID (NULL on pre-feature rows) |
| `created_at` | timestamptz | default now() |

### `order_items`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | default `gen_random_uuid()` |
| `order_id` | uuid FK | not null, references `orders.id` with cascade delete |
| `menu_item_id` | uuid | not null, logical ref to item-service `menu_items` |
| `item_name` | varchar(255) | not null, snapshot at order time |
| `item_price` | numeric | not null, snapshot at order time (backend owns price) |
| `quantity` | int | not null, min 1 |

**Order status lifecycle** (advanced by RMQ events on `orders_queue`):
`pending` → `cooking` → `ready` → `dispatched`, with `cancelled` as the terminal
user-cancelled state. Late events never revive a cancelled order.

**Key decisions:**
- Backend fetches each item from item-service and calculates prices (never trust client)
- Item name/price snapshotted per line at order time (menu changes don't affect old orders)
- Historical single-line rows were backfilled into `order_items` during migration

## kitchen-service — `tickets`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | default `gen_random_uuid()` |
| `order_id` | uuid | not null, logical ref to orders-service `orders` |
| `customer_name` | varchar(100) | not null |
| `items` | jsonb | not null, array of `{ menuItemId?, itemName, quantity }` snapshots |
| `street` | varchar(255) | not null |
| `area` | varchar(255) | not null |
| `status` | varchar(50) | not null, default `received`; one of `received`, `cooking`, `ready`, `rejected` |
| `correlation_id` | varchar(36) | nullable, forwarded from `order_created` |
| `created_at` | timestamptz | default now() |

Ticket status is driven by kitchen staff: `received` → `cooking` (accept) →
`ready` (complete), or `rejected` (cancel the order). Line snapshots live as JSON
because tickets are write-once, read-whole. Legacy rows carry items without
`menuItemId`.

## rider-service — `dispatches`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | default `gen_random_uuid()` |
| `order_id` | uuid | not null, logical ref to orders-service `orders` |
| `customer_name` | varchar(100) | not null |
| `items` | jsonb | not null, array of `{ menuItemId?, itemName, quantity }` snapshots |
| `street` | varchar(255) | not null |
| `area` | varchar(255) | not null |
| `status` | varchar(50) | not null, default `dispatched` (field is `riderStatus` in code) |
| `correlation_id` | varchar(36) | nullable, forwarded from `order_ready` |
| `created_at` | timestamptz | default now() |

## Cross-service references

```
item-service.menu_items.id  ←  orders-service.order_items.menu_item_id
orders-service.orders.id  ←  orders-service.order_items.order_id (real FK)
orders-service.orders.id  ←  kitchen-service.tickets.order_id
orders-service.orders.id  ←  rider-service.dispatches.order_id
```

These are logical references enforced at the application layer, not database-level
foreign keys — except `menu_items.category_id` and `order_items.order_id`, which are
real FKs with cascade delete. Each service only queries its own database.
