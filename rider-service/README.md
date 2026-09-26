# rider-service — SwiftBite

Consumes `rider_queue`, assigns a rider, records the dispatch, emits status.
No HTTP API; health endpoint on **3011**.

## Flow

1. `order_ready` arrives → random rider assigned → dispatch row (`dispatched`)
2. Emits `order_dispatched` to `orders_queue` with the rider name

Dispatches store line snapshots as JSON (`items`), matching kitchen tickets.

## Environment

| Var | Notes |
|-----|-------|
| `DATABASE_URL` | `rider_db` connection string (least-privilege role) |
| `RABBITMQ_URL` | broker URL |
| `HEALTH_PORT` | default 3011 |
| `NODE_ENV` | `development` pretty logs, `production` JSON logs |

## Scripts

```bash
pnpm install
pnpm db:generate   # new migration from schema
pnpm db:migrate    # apply migrations
pnpm db:migrate:test  # apply migrations to the test database
pnpm test          # service specs need the test database, they skip loudly without it
pnpm start:dev
pnpm build
```

Health: http://localhost:3011/health. See
[database-schema](../docs/database-schema.md) for `dispatches`.
