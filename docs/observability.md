# Observability

JSON logging, correlation IDs, and how to trace an order end to end.

## Logging (Pino)

Every service logs through `nestjs-pino`. Behavior follows `NODE_ENV`:

| Environment | Format | Level | Where |
|---|---|---|---|
| production (Docker) | single-line JSON | `info` | stdout → `docker-compose logs` |
| development (`start:dev`) | pretty, colorized | `debug` | terminal |
| test | silent | — | keeps test output clean |

No code changes were needed at the 13 existing `logger.*` call sites — pino replaced
the engine underneath Nest's `Logger` API. Request auto-logging (method, url, status,
`responseTime`) is on for business routes; `/health` and `/health/readiness` are
excluded so Consul + Docker probes don't flood the logs. Authorization headers and
password fields are redacted.

`pino-pretty` is a devDependency on purpose: the pretty transport only loads outside
production, so the pruned prod image never tries to resolve it. Don't invert that
condition.

## Correlation IDs

One UUID per journey, four jobs: mint-or-honor, store, forward, persist.

- **Orders (entry point):** middleware honors incoming `x-correlation-id` or mints one,
  echoes it in the response header, and scopes it via `AsyncLocalStorage`.
- **Forwarding:** included in `order_created` → `order_ready` RMQ payloads.
- **Kitchen/rider:** handlers wrap work in the payload's ID (`als.run`); missing IDs
  are minted with a warning, never fatal.
- **Auth/item:** honor the header in middleware + logs (no persistence, no forwarding).
- **Persistence:** `correlation_id` column (nullable `varchar(36)`) on `orders`,
  `tickets`, `dispatches`.
- **Log attachment:** a pino `mixin` reads the ALS store, so every line — manual logs
  and request logs alike — carries `correlationId` with zero call-site changes.

## Trace an order (the recipe)

```bash
# 1. Place an order with a known ID (or read the echoed x-correlation-id header)
curl -X POST http://localhost:3002/orders \
  -H 'Content-Type: application/json' -H 'x-correlation-id: debug-1' \
  -d '{"customerName":"...","menuItemId":"<uuid>","quantity":1,"street":"...","area":"..."}'

# 2. Follow it through all log streams at once
docker-compose logs --no-log-prefix | grep "debug-1"

# 3. Confirm the same ID in all three rows (psql/Neon console)
SELECT id, status FROM orders WHERE correlation_id = 'debug-1';
SELECT order_id, status FROM tickets WHERE correlation_id = 'debug-1';
SELECT order_id, status FROM dispatches WHERE correlation_id = 'debug-1';
```

One ID, three databases, five log streams (auth/item join in when the caller forwards
the header — e.g. a frontend session ID).

## Dead-letter queues

`kitchen_queue` and `rider_queue` declare a dead-letter route to
`kitchen_queue.dlq` / `rider_queue.dlq` (default exchange, routing key =
DLQ name). Consumers run with `noAck: false`: success acks, any failure
nacks without requeue, so poison messages land in the DLQ instead of
retrying forever or vanishing.

Each DLQ has a dedicated consumer (kitchen owns `kitchen_queue.dlq`,
rider owns `rider_queue.dlq`) that logs one error line per message and
acks it. Never re-queued, no redelivery — inspect and replay by hand:

```bash
# Watch for poison (payload truncated at 2000 chars in the log line)
docker-compose logs kitchen-service rider-service | grep "DLQ ALERT"

# Replay a dead message: republish its payload to the main queue
# via http://localhost:15672 (guest/guest), then watch it flow again
```

Compensation still applies: when a *validated* `order_created` payload
fails ticket creation, kitchen emits `order_failed` (order → cancelled)
in addition to the DLQ routing. Malformed payloads DLQ only — there is
no trustworthy `orderId` to compensate.

## Health endpoints (for probes and humans)

| Service | Liveness | Readiness checks |
|---|---|---|
| auth-service :3000 | `/health` | Neon |
| item-service :3001 | `/health` | Neon |
| orders-service :3002 | `/health` | Neon + RMQ |
| kitchen-service :3010 | `/health` | Neon + RMQ |
| rider-service :3011 | `/health` | Neon + RMQ |

Consul polls these every 10s as its service health checks — the same endpoints that
drive Docker healthchecks, K8s probes-to-be, and manual `curl` debugging.
