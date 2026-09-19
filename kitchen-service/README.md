# kitchen-service — SwiftBite

Consumes `kitchen_queue`, cooks tickets, notifies rider and orders queues.
No HTTP API; health endpoint on **3010**.

## Flow

1. `order_created` arrives → ticket row (`received`) → emits `order_cooking` to `orders_queue`
2. Simulates cooking (2s)
3. Emits `order_ready` to `rider_queue` **and** `orders_queue`

Tickets store line snapshots as JSON (`items`), so the future kitchen display
needs no join back to orders.

## Environment

| Var | Notes |
|-----|-------|
| `DATABASE_URL` | `kitchen_db` connection string (least-privilege role) |
| `RABBITMQ_URL` | broker URL |
| `HEALTH_PORT` | default 3010 |
| `NODE_ENV` | `development` pretty logs, `production` JSON logs |

## Scripts

```bash
pnpm install
pnpm db:generate   # new migration from schema
pnpm db:migrate    # apply migrations
pnpm start:dev
pnpm build
```

Health: http://localhost:3010/health. See
[database-schema](../docs/database-schema.md) for `tickets`.
