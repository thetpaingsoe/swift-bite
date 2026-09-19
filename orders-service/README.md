# orders-service — SwiftBite

Order placement, tracking, and cancellation plus event-driven status updates.
HTTP on **3002**, consumes `orders_queue` on RabbitMQ.

## Endpoints (all need Bearer JWT)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/orders` | body: customerName, street, area, lines[{menuItemId, quantity}]; fetches prices from item-service, snapshots per line, emits `order_created` |
| GET | `/orders?page=&limit=&status=` | own orders (admin: all), paginated, optional status filter |
| GET | `/orders/:id` | one order with lines; owner or admin |
| PATCH | `/orders/:id/cancel` | pending only, else 409 |
| GET | `/health`, `/health/readiness` | liveness, DB + RMQ reachability |

Interactive docs: http://localhost:3002/api

## Consumed events (`orders_queue`)

| Event | Effect |
|-------|--------|
| `order_cooking` | status → `cooking` |
| `order_ready` | status → `ready` |
| `order_dispatched` | status → `dispatched` |

Cancelled orders ignore late events. Statuses: `pending → cooking → ready → dispatched`, `cancelled` terminal.

## Environment

| Var | Notes |
|-----|-------|
| `DATABASE_URL` | `orders_db` connection string (least-privilege role) |
| `PORT` | default 3002 |
| `RABBITMQ_URL` | broker URL |
| `ITEM_SERVICE_URL` | fallback when Consul discovery misses |
| `AUTH_SERVICE_URL` | default `http://localhost:3000`, token verification target |
| `NODE_ENV` | `development` pretty logs, `production` JSON logs |

## Scripts

```bash
pnpm install
pnpm db:generate   # new migration from schema
pnpm db:migrate    # apply migrations
pnpm start:dev
pnpm build
```

See [database-schema](../docs/database-schema.md) for `orders` + `order_items`.
