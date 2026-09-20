# kitchen-service — SwiftBite

Human-driven ticket queue for the kitchen. Hybrid app: HTTP API on **3012** for
the kitchen screen, and an RMQ consumer on `kitchen_queue` for incoming orders.

## Flow

Orders no longer cook automatically. Staff drive every step.

```
received --accept--> cooking --complete--> ready --> (rider) dispatched
   |                    |
   +-----reject---------+---> rejected
```

| Action | Ticket status | Event emitted | Order status |
|--------|---------------|---------------|--------------|
| `order_created` arrives | `received` | none | `pending` |
| accept | `cooking` | `order_cooking` | `cooking` |
| complete | `ready` | `order_ready` (rider + orders) | `ready` → `dispatched` |
| reject | `rejected` | `order_failed` | `cancelled` |

Reject is allowed on `received` and `cooking`, not once `ready`. Bad transitions
return 409.

## Endpoints (Bearer JWT, role kitchen or admin)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/tickets?status=` | queue, oldest first, optional status filter |
| GET | `/tickets/:id` | one ticket |
| PATCH | `/tickets/:id/accept` | received → cooking |
| PATCH | `/tickets/:id/complete` | cooking → ready, notifies rider |
| PATCH | `/tickets/:id/reject` | received or cooking → rejected, cancels order |
| GET | `/health`, `/health/readiness` | liveness, DB + RMQ reachability |

Interactive docs: http://localhost:3012/api

## Notes

- Tickets store line snapshots as JSON (`items`), so no join back to orders.
- The `rejected` ticket status is deliberately distinct from the order's
  `cancelled`: kitchen reporting can tell a kitchen refusal from a customer cancel.
- Known gap: a customer can cancel while the order is `pending`, and kitchen is not
  notified, so a ticket could be cooked for a cancelled order. Left out of scope.

## Environment

| Var | Notes |
|-----|-------|
| `DATABASE_URL` | `kitchen_db` connection string (least-privilege role) |
| `PORT` | HTTP API + health port, default 3012 |
| `RABBITMQ_URL` | broker URL |
| `AUTH_SERVICE_URL` | default `http://localhost:3000`, token verification target |
| `CONSUL_URL` | default `http://localhost:8500` |
| `SERVICE_NAME` / `SERVICE_ADDRESS` / `SERVICE_PORT` | Consul registration |
| `NODE_ENV` | `development` pretty logs, `production` JSON logs |

## Scripts

```bash
pnpm install
pnpm db:generate   # new migration from schema
pnpm db:migrate    # apply migrations
pnpm start:dev
pnpm build
```

See [database-schema](../docs/database-schema.md) for `tickets`.
