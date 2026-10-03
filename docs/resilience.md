# Resilience

How SwiftBite handles failure: fail fast, retry transient blips, park poison
messages, throttle abuse, and compensate when a multi-step order breaks. Each
pattern is small on its own; together they keep one failing service from taking
the whole order flow down.

## Circuit breaker (orders-service → item-service)

Placing an order needs live prices from item-service. Without a breaker, a slow or
down item-service makes every checkout hang. The breaker wraps the fetch in
`opossum` and fails fast once the dependency is clearly sick:

- **Closed**: normal. Calls go through.
- **Open**: 5 failures within the rolling window open the circuit for 30s. Calls
  short-circuit with `503 Service Unavailable` before any DB write, so no orphan
  order rows.
- **Half-open**: after 30s one trial call goes through. Success closes the
  circuit; failure opens it again.

Only real dependency failures count. The `errorFilter` excludes 4xx and
`NotFoundException` (a bad item id is the caller's fault, not the dependency's),
so they never trip the breaker. Every transition logs
`item-service circuit open|half-open|closed` with the order's `correlationId`.

Config: `ITEM_BREAKER_RESET_TIMEOUT_MS` (default 30000). The rest are constants:
timeout 20s, volume threshold 5, error threshold 50%.

## Retry

Two independent retry paths, both sharing one rule: retry **transient** errors
only, never blind-retry writes that could duplicate rows.

- **RMQ consumers** (`rmq-retry.ts`, kitchen and rider): up to 3 attempts, 200ms
  fixed delay, for connection/timeout/deadlock/serialization errors only.
  Validation errors and other permanent failures nack straight to the DLQ.
  Kitchen compensates (`order_failed`) only after the final failure, so a blip
  doesn't cancel a healthy order.
- **item fetch** (orders-service): 3 attempts, 200ms, on timeout/no-response/5xx.
  A 404 is immediate. The base URL is re-resolved from Consul on each attempt, so
  a failover actually lands on a fresh instance. Exhausting retries surfaces as
  "item not found"; the breaker owns the `503`.

No DB writes are retried in a loop. Each message delivery attempts its write once;
transient Postgres codes are the only thing the consumer retries.

## Dead-letter queues

`kitchen_queue` and `rider_queue` route failed messages to `kitchen_queue.dlq`
and `rider_queue.dlq`. Consumers run `noAck: false`: success acks, failure nacks
without requeue. After retries are exhausted (or immediately, for permanent
failures), the message lands in the DLQ instead of retrying forever or vanishing.

Each DLQ has a dedicated consumer (`kitchen-service` owns `kitchen_queue.dlq`,
`rider-service` owns `rider_queue.dlq`). It logs one `DLQ ALERT` error line with
the payload and `correlationId`, then acks. Never re-queued — inspect and replay
by hand via the RabbitMQ UI. See [observability.md](./observability.md) for the
DLQ log recipe.

`orders_queue` has no DLQ: its handler terminus is log-and-drop, because the
status events it carries are already durable in the source databases.

## Rate limiting

`POST /orders` is the only public write endpoint and fans out to item-service, the
database, and RabbitMQ on every call. `@nestjs/throttler` guards it at **10
requests per 60 seconds per IP** (after `AuthGuard`). Over the limit returns `429`
with a `Retry-After` header and a dynamic message, and no order is created. Reads
and login are untouched.

Config: `THROTTLE_LIMIT` (10), `THROTTLE_TTL_MS` (60000). Storage is in-memory,
so the limit is per instance — fine for the single-instance setup; a multi-replica
deploy would need shared storage.

## Saga compensation

An order spans three services and three databases, so there is no single
transaction to roll back. Instead, failures are compensated. There are two
shapes.

**Undo — kitchen can't fulfil.** The cook rejects the ticket. Kitchen emits
`order_failed` on `orders_queue`, orders-service sets the order to `cancelled`.
This fires without the buyer doing anything: a failure event triggers the cleanup.
(The buyer's own cancel button is a separate feature, not compensation.)

**Flag — the food is made but no rider comes.** Cancelling is wrong here: the
kitchen already committed resources. When an order sits `ready` with no dispatch
for `RIDER_REVIEW_AFTER_MIN` (default 10) minutes, the `ReviewService` sweeper
marks it `needs_review` and logs a warning with the `correlationId`. A human
decides what next. If a rider eventually picks it up, the late `order_dispatched`
event still advances the order to `dispatched`. A duplicate `ready` cannot
postpone the sweep — `ready_at` is stamped once.

Config: `RIDER_REVIEW_AFTER_MIN` (10), `RIDER_REVIEW_INTERVAL_MS` (60000),
`RIDER_REVIEW_ENABLED` (true).

## Guaranteed order_created delivery

Order creation saves the row and then emits `order_created`. If the broker is down
at that moment, a naive emit loses the order silently. Instead:

1. The order row is inserted with `kitchen_notified = false` **before** the emit,
   so a crash in between is still visible.
2. On emit success, a guarded write sets `kitchen_notified = true`. That write can
   never fail the buyer's request — a failed flag update only means a duplicate
   emit later.
3. `ReconcileService` sweeps on startup and every 30s
   (`KITCHEN_RECONCILE_INTERVAL_MS`) for `pending` orders with
   `kitchen_notified = false` and re-emits them with their original phone, note,
   and `correlationId`. The flag clears only on success.
4. Kitchen's `createTicket` is idempotent: check-then-insert plus the
   `tickets_order_id_unique` index and a 23505 race guard. A re-emitted
   `order_created` never creates a second ticket.

The sweep uses a per-process in-flight guard. Two orders-service replicas could
sweep the same row; kitchen dedupes by `orderId`, so the cost is wasted work, not
duplicates.

Config: `KITCHEN_RECONCILE_INTERVAL_MS` (30000), `KITCHEN_RECONCILE_ENABLED`
(true). Set `KITCHEN_RECONCILE_ENABLED=false` to quiet the sweep when you don't
need it.

## Environment variables

| Var | Default | Used by |
|-----|---------|---------|
| `ITEM_BREAKER_RESET_TIMEOUT_MS` | 30000 | orders-service breaker |
| `THROTTLE_LIMIT` | 10 | orders-service rate limit |
| `THROTTLE_TTL_MS` | 60000 | orders-service rate limit |
| `RIDER_REVIEW_AFTER_MIN` | 10 | orders-service review sweeper |
| `RIDER_REVIEW_INTERVAL_MS` | 60000 | orders-service review sweeper |
| `RIDER_REVIEW_ENABLED` | true | orders-service review sweeper |
| `KITCHEN_RECONCILE_INTERVAL_MS` | 30000 | orders-service reconciler |
| `KITCHEN_RECONCILE_ENABLED` | true | orders-service reconciler |

`rmq-retry` attempts and delay (3 × 200ms) are code constants, not env vars.
