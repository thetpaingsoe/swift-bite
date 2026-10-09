# SwiftBite — Production Readiness Action Plan

**Tech Stack:** NestJS 11 / TypeScript 5.7 / Drizzle ORM / Neon Postgres / RabbitMQ / React (Vite) / Tailwind CSS
**Recommended Stack:** Pino + Joi + pnpm + Jest

**Services (5 total):**
| Service | Database | Transport | Port | Owns |
|---------|----------|-----------|------|------|
| auth-service | auth-db | HTTP | 3000 | Users, JWT |
| item-service | item-db | HTTP | 3001 | Menu items, categories |
| orders-service | orders-db | HTTP + RMQ | 3002 | Orders |
| kitchen-service | kitchen-db | RMQ | — | Tickets |
| rider-service | rider-db | RMQ | — | Dispatches |

---

## 📊 Progress Tracker

**Overall:** `124 / 194 items completed (64%)`

```
Phase 1  — Foundation         [██████████]  33/33  (100%)
Phase 2  — Operations         [██████████]  24/24  (100%)
Phase 3  — Observability      [██████████]  13/13  (100%)
Phase 4  — Resilience         [██████████]  26/26  (100%)
Phase 5  — Organization       [███░░░░░░░]  2/8    (25%)
Phase 6  — Frontend           [██████████]  26/26  (100%)
Phase 7  — Integration        [░░░░░░░░░░]  0/7    (0%)
Phase 8  — Payments           [░░░░░░░░░░]  0/10   (0%)
Phase 9  — Realtime           [░░░░░░░░░░]  0/6    (0%)
Phase 10 — Notifications      [░░░░░░░░░░]  0/5    (0%)
Phase 11 — Menu/Search/Media  [░░░░░░░░░░]  0/8    (0%)
Phase 12 — Customer Account   [░░░░░░░░░░]  0/6    (0%)
Phase 13 — Kitchen/Rider Ops  [░░░░░░░░░░]  0/6    (0%)
Phase 14 — Admin              [░░░░░░░░░░]  0/5    (0%)
Phase 15 — Prod Readiness     [░░░░░░░░░░]  0/11   (0%)
```

> Update the `#/#` counts and replace `░` with `█` as you complete items.

**Last action completed:** SEED-12 Consul ghost-hardening (hostname health checks, consul healthy-gate, 60s re-register heartbeat, 4/4 scenarios live-verified) | **Date:** 2026-09-30

---

## Phase 1 — Foundation (Security & Error Handling)

### 1.0 Auth-service (complete)
- [x] Scaffold `main/auth-service/` with NestJS 11 / TypeScript 5.7 / Drizzle ORM
- [x] Create DB schema (users table: id, name, email, password_hash, created_at)
- [x] Implement auth.service.ts (register, login, verifyToken) with bcrypt + @nestjs/jwt
- [x] Implement auth.controller.ts (POST /auth/register, POST /auth/login, GET /auth/verify)
- [x] ConfigModule with ignoreEnvFile for test mode
- [x] ValidationPipe with whitelist, forbidNonWhitelisted, transform
- [x] DTOs: register.dto.ts (password rules: min 8, uppercase, number, special char), login.dto.ts
- [x] DB migration (npm run db:generate + db:migrate) — users table in Neon
- [x] 15 feature tests passing (test/auth.e2e-spec.ts)

### 1.1 Create .env.example files
- [x] Verify `.env` is listed in `.gitignore` (confirmed — already done in all 3 services)
- [x] Confirm `.env` files are not tracked by git (confirmed — `git ls-files` shows none tracked)
- [x] Create `.env.example` for each service listing all required env vars with placeholder values
- [x] Create auth-service with its own database (users table)
- [x] Create item-service with its own database (menu items + categories tables)

### 1.2 Add `@nestjs/config` with Joi validation
- [x] Install `@nestjs/config` + `joi` in all 3 services
- [x] Register `ConfigModule.forRoot({ validationSchema })` in each `AppModule`
- [x] Define a Joi schema validating: `DATABASE_URL`, `PORT` (orders only), `RABBITMQ_URL`, `NODE_ENV`
- [x] Move all `process.env.*` access to `ConfigService` injection
- [x] Move RMQ credentials to env vars (stop hardcoding `guest:guest`)

### 1.3 Add validation pipe
- [x] Install `class-validator` + `class-transformer` in orders-service
- [x] Create `CreateOrderDto` in `src/orders/dto/create-order.dto.ts` with `@IsString()`, `@IsInt()`, `@Min(1)` etc.
- [x] Register `ValidationPipe` globally in `orders-service/src/main.ts`

### 1.4 Add global exception filter
- [x] Create `src/common/filters/all-exceptions.filter.ts` in each service
- [x] Register it as a global filter via `app.useGlobalFilters()` in `main.ts`
- [x] Log errors with structured format (prepares for Pino later)

### 1.5 Add error handling to business logic
- [x] Wrap all DB inserts in try/catch in all 3 `app.service.ts` files
- [x] Wrap all RMQ `.emit()` calls in try/catch
- [x] `await` the `ClientProxy.emit()` promise (or `.catch()`) — orders-service line 26
- [x] Add error recovery / graceful degradation where appropriate
- [x] Migrate all service + controller `console.log` to NestJS `Logger` (services: orders, kitchen, rider, auth, item; controllers: kitchen, rider)

### 1.6 Clean up code issues
- [x] Remove unused import `duration` from `drizzle-orm/gel-core` in:
  - `orders-service/src/app.module.ts` (line 5)
  - `rider-service/src/main.ts` (line 6)
- [x] Fix typos:
  - `kitchen-service/src/main.ts` line 18: `"kitchen servie"` → `"kitchen service"`
  - `rider-service/src/main.ts` line 24: `"Rider Serivce"` → `"Rider Service"`
- [x] Standardize column naming: `kitchen-service/src/db/schema.ts` line 6: `customName` → `customerName`

---

## Phase 2 — Operations (Graceful Shutdown, Health Checks, Docker)

### 2.1 Standardize on pnpm
- [x] For `orders-service` and `kitchen-service`:
  - Delete `package-lock.json`
  - Run `pnpm import` to generate `pnpm-lock.yaml` from existing deps
  - Add `pnpm-workspace.yaml` at `main/` level (rider already has it)
- [x] Create root `pnpm-workspace.yaml`:
  ```yaml
  packages:
    - 'orders-service'
    - 'kitchen-service'
    - 'rider-service'
  ```

### 2.2 Enable graceful shutdown
- [x] Add `app.enableShutdownHooks()` in all 3 `main.ts` files
- [x] Register `SIGTERM`/`SIGINT` handlers that:
  - Close RMQ connections
  - Close DB connections
  - Wait for in-flight requests to complete
  - Exit cleanly

### 2.3 Add health check endpoints
- [x] Install `@nestjs/terminus` in all 5 services
- [x] Create health controller with:
  - `GET /health` — liveness probe (service is running)
  - `GET /health/readiness` — readiness probe (DB + RMQ are reachable)
- [x] Register `TerminusModule` with `NeonHealthIndicator` and `RmqHealthIndicator`
- [x] Expose health endpoints on dedicated ports for kitchen (:3010) and rider (:3011)
- [x] Add RMQ ping to readiness probe (orders, kitchen, rider)
- [x] Register HealthModule in auth-service and item-service as child modules

### 2.4 Add Dockerfiles
- [x] Create `main/Dockerfile` (multi-stage build, shared across services with build args):
  ```dockerfile
  # Build stage
  FROM node:22-alpine AS build
  WORKDIR /app
  COPY package.json pnpm-lock.yaml ./
  RUN pnpm install
  COPY . .
  RUN pnpm build
  
  # Production stage
  FROM node:22-alpine
  WORKDIR /app
  COPY --from=build /app/dist ./dist
  COPY --from=build /app/node_modules ./node_modules
  EXPOSE 3000
  CMD ["node", "dist/main"]
  ```
- [x] Create service-specific Dockerfiles that set the correct entry point

### 2.5 Update docker-compose
- [x] Add service definitions for all 5 services in `docker-compose.yml`
- [x] Set up proper networking so services can reach each other by hostname
- [x] Define env vars per service (or use `.env` file)
- [x] Add healthcheck for RabbitMQ
- [x] Create Docker setup documentation

### 2.6 Service Discovery
- [x] Set up Consul or DNS-based service discovery in Docker (`consul` dev agent in docker-compose.yml, API :8500, DNS :8600)
- [x] Each service registers itself on startup with name + host + port (`ConsulService` in all 5 services, ID = name + hostname, register after listen)
- [x] orders-service discovers item-service dynamically instead of hardcoded URL (`DiscoveryService`: 10s cache, random pick, `ITEM_SERVICE_URL` fallback, invalidate on connection failure)
- [x] Add health check registration for each service (HTTP checks on `/health`, 10s interval, `DeregisterCriticalServiceAfter: 1m`)
- [x] Handle service deregistration on shutdown (`onModuleDestroy` + shutdown hooks; added missing `enableShutdownHooks()` to auth-service)

### 2.7 Enable strict TypeScript
- [x] In all 5 `tsconfig.json` files:
  - Set `"strict": true` (which enables `noImplicitAny`, `strictNullChecks`, etc.)
  - Fix all resulting type errors
- [x] Consider adding `"noUnusedLocals": true` and `"noUnusedParameters": true` for extra safety

---

## Phase 3 — Observability (Logging, Tracing, Docs)

### 3.1 Replace console.log with structured logging
- [x] Install `nestjs-pino` + `pino-pretty` (dev) in all 5 services (action items said `@nestjs/pino` — wrong name, real package is `nestjs-pino` v5)
- [x] Register `LoggerModule.forRootAsync()` in each `AppModule` (level by `NODE_ENV`: JSON/`info` prod, pretty/`debug` dev, `silent` test; redact auth/password fields; `/health*` excluded from request logs)
- [x] Replace all `console.log()` calls with `this.logger.log()` / `.warn()` / `.error()` (existing Nest `Logger` calls became structured with zero edits; bootstrap lines converted; `seed.ts` CLI intentionally left out)
- [x] Ensure logs are JSON-formatted in production, pretty-printed in development (via `NODE_ENV`) — verified live in all 5 containers

### 3.2 Add correlation IDs across services
- [x] In orders-service (HTTP entry point):
  - Create middleware that generates a `correlationId` (UUID) for each incoming request (mints or honors incoming, echoes in response header)
  - Attach it to `req.headers['x-correlation-id']`
  - Inject it into logger context (AsyncLocalStorage + pino `mixin`, zero call-site changes)
- [x] Pass `correlationId` in RMQ message payloads (`order_created` → `order_ready`)
- [x] In kitchen-service and rider-service:
  - Read `correlationId` from incoming RMQ messages (warn-and-mint fallback when absent)
  - Set it on the logger context for traceability (`als.run` handler wrap)
- [x] This lets you trace a single order through all 3 services (verified live: one ID in 3 DB rows + 3 log streams; column persisted as nullable `varchar(36)`, no backfill; auth/item also honor `x-correlation-id` in middleware + logs, no persistence there)

### 3.3 Add Swagger/OpenAPI docs
- [x] Install `@nestjs/swagger` in auth, item, and orders services (v11 to match Nest 11)
- [x] Add `SwaggerModule.setup('api', app, document)` in each `main.ts` with bearer auth
- [x] Decorate DTOs with `@ApiProperty()` decorators (register, login, items, categories, orders)
- [x] Decorate controllers with `@ApiOperation()`, `@ApiResponse()`, `@ApiBearerAuth()`
- [x] Access docs at `http://localhost:3000/api`, `:3001/api`, `:3002/api` (Swagger UI, verified live)

---

## Phase 4 — Resilience (Retry, DLQ, Rate Limiting)

### 4.1 Add dead-letter queues for RMQ
- [x] Configure DLQ args for `kitchen_queue` and `rider_queue` (failed messages go to `*.dlq`)
- [x] Set up a DLQ consumer that logs/alerts (no re-queue machinery)
- [x] Live-verify: poison message lands in the DLQ

### 4.2 Add retry logic (RMQ-only)
- [x] RMQ consumers reject failed messages so they route to the DLQ after max retries (SEED-8: `src/rmq/rmq-retry.ts` per service — MAX_ATTEMPTS=3, 200ms fixed delay, retryable = conn/timeout/deadlock/serialization codes only; validation + permanent failures nack straight to DLQ; kitchen compensates only on final failure)
- [x] Retry wrapper around the item-service fetch in orders-service (ties into 4.4) (SEED-8: `orders-service/src/orders/app.service.ts` `fetchItem` — 3 attempts/200ms on transient no-response/timeout/5xx only, 404 immediate, exhaust still throws NotFound; 4.4 owns the 503 breaker)
- [x] No blind retries on DB writes (Neon failures are rarely transient-retryable; writes risk duplicates) (SEED-8: one DB attempt per delivery, no p-retry/inner loop; selective retry of transient conn codes only; orders `orders_queue` got manual ack/nack via `noAck:false` + `@Ctx()`, terminus is log+drop with no DLQ per 4.1)

### 4.3 Add rate limiting
- [x] Install `@nestjs/throttler` in orders-service (SEED-9: `@nestjs/throttler@6.7.1`)
- [x] Configure `ThrottlerModule` with sensible defaults (e.g., 10 requests/60 seconds per IP) (SEED-9: `forRootAsync`, env-tunable `THROTTLE_LIMIT`=10 / `THROTTLE_TTL_MS`=60000, dynamic retry-hint error message; tunables added to `orders-service/.env.example`)
- [x] Scope to `POST /orders` (only public write endpoint; skip auth/item reads) (SEED-9: `ThrottlerGuard` after `AuthGuard` on `POST /orders` only; service spec 4/4 green — burst→429 with `Retry-After`, GETs unaffected, window reset→201; live-verified 12 rapid orders → 10×201 + 2×429, reset→201; 4xx demoted to warn in `AllExceptionsFilter` so bursts don't spam error logs)

### 4.4 Add circuit breaker for inter-service calls
- [x] Install `opossum` in orders-service (verified missing 2026-09-27 despite the skill claiming it — correct the skill when done) (SEED-10: `opossum@10.0.0` + `@types/opossum`; skill claim now true as written — 5 failures / 30s / half-open — no edit needed)
- [x] Wrap item-service HTTP calls with circuit breaker (add HTTP timeout as part of this) (SEED-10: breaker around `fetchItemWithRetry` in `orders-service/src/orders/app.service.ts`; explicit 5s per-attempt axios + rxjs timeout; opossum timeout 20s covers the retry budget)
- [x] Configure: 5 failures → open circuit for 30s → half-open → retry (SEED-10: `volumeThreshold` 5 / `errorThreshold` 50% / `resetTimeout` 30s, env-tunable `ITEM_BREAKER_RESET_TIMEOUT_MS`; 4xx errorFilter so bad item ids never trip it)
- [x] Return meaningful error when circuit is open (503 Service Unavailable) (SEED-10: `ServiceUnavailableException` "temporarily unavailable", thrown before any DB insert; unit + live verified)
- [x] Add circuit breaker metrics/logging for observability (SEED-10: open/half-open/closed via Nest Logger → Pino with `correlationId`; logs-only, no dashboard per scope)

### 4.5 Add saga pattern (compensation)
- [x] orders-service emits `order_created` (verified: `orders-service/src/orders/app.service.ts` emit; `correlationId` + `orderId` serve as the saga identity — separate saga ID dropped as redundant)
- [x] kitchen-service reject emits `order_failed` (verified: `kitchen-service/src/tickets/app.service.ts` `notifyOrders('order_failed', ...)`)
- [x] orders-service listens for `order_failed`, updates order status to `cancelled` (verified: `orders-service/src/orders/app.controller.ts` `@EventPattern('order_failed')`)
- [x] `cancelled` status supported (verified: `list-orders.dto.ts` allows it, service guards terminal `cancelled`)
- [x] Compensation logging for observability (verified live 2026-09-12: reject → cancel flow)
- [x] Handle partial failures (e.g., kitchen succeeds but rider fails) (SEED-11: timed review-flag — `orders.ready_at` stamped on `ready`, `ReviewService` sweeper flags `ready` older than `RIDER_REVIEW_AFTER_MIN`=10 as `needs_review`, `correlationId` log, late `order_dispatched` still advances to `dispatched`, duplicate kitchen events can't regress the flag; unit 9/9 + live-verified outage/flag/heal/reject)

### 4.6 Harden Consul registration (ghost prevention)
- [x] Point health-check URLs at the container hostname (`os.hostname()`), keep `Address` as the shared Compose name — dead incarnations go critical instead of borrowing successors' heartbeats (SEED-12, all 5 services, live-verified kill+recreate)
- [x] Add `depends_on: consul (service_healthy)` in compose for deterministic boot ordering (SEED-12, all 5 app services, live-verified boot wait)
- [x] Add 60s re-registration heartbeat in `ConsulService` (unref'd timer, cleared in `onModuleDestroy`) — covers agent-amnesia, not ghosts (SEED-12, fresh-agent recovery 5/5 in 22s, no restarts)

### 4.7 Guaranteed `order_created` delivery
- [x] Flag orders whose `order_created` emit failed after the DB save (SEED-13: nullable `orders.kitchen_notified`, insert-unsent-first so a crash between save and emit stays visible, set-true-after-emit in guarded write that can never 500 the buyer; migration `0009`)
- [x] Add a reconciler (startup sweep + 30s interval with in-flight guard, `KITCHEN_RECONCILE_*` env vars in `.env.example` + compose; re-emits pending unsent rows with original phone/note/correlationId, clears flag only on success; kitchen `createTicket` idempotent via check-then-insert + unique index `tickets_order_id_unique` + 23505 race guard, migration `0006`)
- [x] Test + live-verify (service specs: flag on emit failure, reconciler re-emit with phone/note, re-emit failure keeps flag, happy-path no-op, concurrent duplicate makes no second ticket — orders 66/66, kitchen 30/30; live broker-down/up run: order saved flagged with zero tickets, sweep re-emitted exactly one ticket with phone/note intact, happy path inline; dev toggle `KITCHEN_RECONCILE_ENABLED=false` for Neon usage)

---

## Phase 5 — Code Organization & Quality

### 5.1 Split into proper domain modules
- **orders-service example:**
  ```
  src/
    orders/
      orders.module.ts
      orders.controller.ts
      orders.service.ts
      dto/
        create-order.dto.ts
        update-order.dto.ts
    kitchen-client/
      kitchen-client.module.ts
      kitchen-client.service.ts   # wraps RMQ ClientProxy
    common/
      filters/
        all-exceptions.filter.ts
      pipes/
        validation.pipe.ts
  ```
- **Apply similar structure to kitchen-service and rider-service**

### 5.2 Move DTOs to separate files
- [x] All DTO classes in dedicated `dto/` directories
- [x] All response types in dedicated `interfaces/` or `types/` directories

### 5.3 Fix and expand tests

**Feature tests (preferred — like Laravel feature tests, uses supertest):**
- [ ] Write feature tests for all 3 services:
  - `orders-service`: `POST /orders` — validates body, returns correct response, rejects bad input
  - `kitchen-service`: `order_created` handler — verifies ticket creation flow
  - `rider-service`: `order_ready` handler — verifies dispatch creation flow
- [ ] Mock DB + RMQ at the module level in feature tests (not real connections)

**Unit tests (optional — for service logic edge cases):**
- [ ] Add unit tests for service methods with mocked DB + RMQ
- [ ] Aim for test structure: feature (behavior, survives refactors) + unit (edge cases, faster feedback)

### 5.4 Add CI/CD pipeline
- Superseded by **15.2** (GitHub Actions: lint + test + build + README badge). Nothing to do here.

### 5.5 Standardize READMEs
- [x] Replaced NestJS boilerplate README with actual project documentation:
  - What the service does
  - Prerequisites (Node, pnpm, Docker)
  - Setup steps
  - Available scripts
  - Environment variables reference
- [x] Created missing READMEs (auth-service, item-service, frontend)

---

## Phase 6 — Frontend (React + Vite + Tailwind)

### 6.1 Project setup
- [x] Create `frontend/` directory with Vite + React + TypeScript
- [x] Install Tailwind CSS for styling
- [x] Set up React Router for navigation
- [x] Configure API proxy to backend services

### 6.2 Auth pages
- [x] Build login page (email + password form)
- [x] Build register page (name + email + password form)
- [x] Store JWT in localStorage/httpOnly cookie
- [x] Add auth context/hook for managing user state
- [x] Protected routes: redirect to login if not authenticated

### 6.3 Menu browsing
- [x] Build menu page with category tabs (Food / Drinks)
- [x] Fetch items from item-service API
- [x] Display items with image, name, description, price
- [x] Add to cart functionality (client-side state)

### 6.4 Order placement
- [x] Build cart/checkout page
- [x] Show cart items with quantity, unit price, total
- [x] Delivery address form (street + area)
- [x] Place order button → calls orders-service API
- [x] Show order confirmation with order ID

### 6.5 Order tracking
- [x] Build order history page (list of user's orders) — `Orders.tsx`, React Query + pagination
- [x] Build order detail page with status timeline — `OrderDetail.tsx` + `OrderStatus.tsx` (`StatusTimeline`)
- [x] Poll orders-service for status updates (pending → cooking → dispatched → delivered) — `refetchInterval` 3s until terminal status (realtime replaces this in Phase 9)
- [x] Show estimated time or status messages — status messages via `StatusText`/`StatusTimeline` (ETA estimate moves to Phase 9)

> Order tracking continues in **Phase 9** (SSE/WebSocket + ETA).

### 6.6 UI polish
- [x] Responsive design (mobile-first) — Tailwind layout across client/admin/kitchen
- [x] Loading states and error handling — skeletons + `isError` states on query routes
- [x] Toast notifications for actions — `sonner` `Toaster` in `main.tsx`
- [x] Clean, modern food delivery UI

---

## Phase 7 — Integration Testing

### 7.1 End-to-end flow tests
- Superseded by **15.3** (E2E: checkout → kitchen accept → dispatch, payment webhook retry, RBAC deny, cancel rules).

### 7.2 Failure scenario tests
- [ ] Test circuit breaker: item-service down → orders fail gracefully
- [ ] Test saga compensation: kitchen fails → order cancelled
- [ ] Test DLQ: message fails → goes to dead letter queue
- [ ] Test service discovery: service goes down → requests route elsewhere

### 7.3 Performance baseline
- [ ] Measure order placement latency (with item-service call)
- [ ] Measure menu fetch latency
- [ ] Identify bottlenecks

---

## Phase 8 — Payments & Checkout

> Schema changes (payment state, timeline, totals) land first. Blocks Phase 14 refunds + revenue.

### 8.1 Order money + state model
- [ ] Add orders columns: `subtotal`, `fee`, `tax` (numeric) alongside existing `total_price`
- [ ] Add payment state (`payment_status`: `pending`/`paid`/`failed`/`refunded`) + `payment_intent_id`
- [ ] Add order timeline table (`order_events`: id, order_id, status, note, created_at) as the detail-timeline source
- [ ] Migration + backfill (existing orders as legacy/paid, timeline seeded from current `status`)

### 8.2 Stripe (test mode)
- [ ] Create PaymentIntent on `POST /orders`; return `client_secret`, save order as `payment_status: pending`
- [ ] Stripe webhook handler on orders-service: signature verify + idempotency key (dedupe by event id)
- [ ] Mark `paid` on `payment_intent.succeeded`; mark `failed` on failure and record it in the timeline
- [ ] Guard `POST /orders` retry against double-charge (idempotency key per attempt; reuse in-flight intent)

### 8.3 Refunds
- [ ] Auto-refund / void the PaymentIntent when kitchen rejects before cooking (`order_failed` before ticket accepted)
- [ ] Manual refund path is Phase 14 (admin refund button)

---

## Phase 9 — Realtime Order Tracking

> Absorbs 6.5 polling. Feeds the Phase 10 notification bell. Polling stays as fallback.

### 9.1 Realtime gateway
- [ ] Add SSE (or WebSocket) gateway on orders-service, JWT-authenticated
- [ ] Push status events: `cooking`, `ready`, `dispatched`, `cancelled`, `failed`
- [ ] Frontend subscribes on order detail + history; replaces the 3s `refetchInterval`
- [ ] Reconnect with backoff + fall back to polling; show connection state in UI

### 9.2 Progress + ETA
- [ ] ETA estimate per status + progress timeline driven by `order_events`
- [ ] Live timeline updates without full refetch

---

## Phase 10 — Notifications

> Consumes Phase 9 events. Kitchen alert assumes the kitchen board is open.

### 10.1 Email
- [ ] Integrate Resend (or Postmark); env + verified sender domain
- [ ] Send on: confirmation, ready, dispatched, cancelled
- [ ] Templates + failure logging (never block an order on email failure)

### 10.2 In-app
- [ ] In-app toast + notification bell backed by an events query
- [ ] Kitchen ticket alert (sound/badge) on new order (shared with 13.1)

---

## Phase 11 — Menu, Search & Media

> Flags/indexes before search + filters. Media endpoint before admin image upload.

### 11.1 Search & filters
- [ ] Add menu item flags: `is_veg`, `is_spicy`; indexes to support filtering
- [ ] Full-text search (name/description) via Postgres `tsvector`
- [ ] Storefront filters: veg, spicy, price range, availability
- [ ] Category / item availability toggle reflected instantly in storefront

### 11.2 Media
- [ ] Move item images to S3/R2 (env-configured bucket + credentials)
- [ ] Admin upload endpoint returning the stored URL (replaces manual `image_url`)
- [ ] Delete / replace removes the old object
- [ ] Drop local disk serving

---

## Phase 12 — Customer Account

> Extends the existing address book. Drops the SEED-14 client-side address cache.

### 12.1 Address book
- [ ] Extend `addresses` schema: `phone`, `line1`, `line2`, `postcode`, `notes` (migrate `street`/`area`)
- [ ] Address book CRUD on auth-service + profile routes (mostly exists; add new fields)
- [ ] Checkout address selector fed by the address book; remove the local-cache fallback hack

### 12.2 Orders + profile
- [ ] Order history pagination (backend + `Orders.tsx`)
- [ ] Re-order button (rebuilds cart from an order's lines)
- [ ] Profile: confirm change-password coverage + logout all devices (token version / denylist)

---

## Phase 13 — Kitchen & Rider Ops

> Rider HTTP API + UI are new and can be deferred separately from kitchen.

### 13.1 Kitchen
- [ ] Kitchen board: sound + badge for new tickets
- [ ] Prep-time display per ticket (accepted-to-ready)
- [ ] `needs_review` handled in the board (ready-but-no-dispatch edge)

### 13.2 Rider
- [ ] Rider HTTP API on rider-service: list queue, claim / assign, pickup confirm, delivery confirm
- [ ] Rider queue UI (claim, pickup, deliver)
- [ ] Auth guard for the rider role

---

## Phase 14 — Admin

> Depends on Phase 8 totals + payment state for revenue and refunds.

### 14.1 Dashboard
- [ ] Revenue, orders/day, top items, failure rate (extends existing `AdminDashboard.tsx`)
- [ ] Backend aggregation endpoints on orders-service

### 14.2 Ops
- [ ] Refund button (calls the Phase 8 refund path)
- [ ] User role management (auth-service admin endpoints + UI)
- [ ] Audit log for admin actions (who, what, when)

---

## Phase 15 — Production Readiness

> Absorbs 5.4 (CI) and Phase 7.1 (E2E). Last phase; other phases can land demoable without it.

### 15.1 Deploy
- [ ] Live demo: frontend on Vercel, backend via Docker Compose on VPS/Render
- [ ] `.env` / secrets strategy for the demo environment

### 15.2 CI
- [ ] GitHub Actions: lint + test + build, badge in README
- [ ] Postgres + RabbitMQ services for tests

### 15.3 E2E + security
- [ ] E2E: checkout → kitchen accept → dispatch
- [ ] E2E: payment webhook retry (idempotency)
- [ ] E2E: RBAC deny (customer blocked from kitchen/admin/rider)
- [ ] E2E: cancel rules (past-pending rejected)
- [ ] Security: helmet, strict DTO validation everywhere, rate-limit checkout + webhook, CORS allowlist

### 15.4 Observability + docs
- [ ] Observability: `/health`, metrics endpoint, correlationId + Pino retained, Grafana screenshot in README
- [ ] Docs: README demo URL, test accounts, architecture diagram, Loom video

---

## Architecture Flow (for reference)

```
Frontend (React)
  ↓ HTTP
auth-service (register/login) → returns JWT
  ↓ HTTP
item-service (browse menu) → returns items
  ↓ HTTP + JWT
orders-service (place order)
  → calls item-service (fetch item details) [with circuit breaker]
  → saves order to DB (with item snapshot)
  → emits "order_created" → RMQ (kitchen_queue)
    ↓
kitchen-service
  → creates ticket in DB
  → waits 2s (simulates cooking)
  → emits "order_ready" → RMQ (rider_queue)
    ↓
rider-service
  → assigns random rider
  → creates dispatch record in DB

Saga Compensation:
  If kitchen-service fails → emits "order_failed"
  → orders-service listens → updates order status to "cancelled"
```

---

*Created: 2026-06-22*
*Last action completed: 2026-10-08 — Phases 8-15 added, Phase 6 marked done*
