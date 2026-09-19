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

**Overall:** `89 / 94 items completed (95%)`

```
Phase 1 — Foundation       [██████████]  33/33  (100%)
Phase 2 — Operations       [██████████]  20/20 (100%)
Phase 3 — Observability    [██████████]  13/13 (100%)
Phase 4 — Resilience       [░░░░░░░░░░]  0/20  (0%)
Phase 5 — Organization     [█░░░░░░░░░]  1/8   (13%)
Phase 6 — Frontend         [█████░░░░░]  5/8   (62%)
Phase 7 — Integration      [░░░░░░░░░░]  0/4   (0%)
```

> Update the `#/#` counts and replace `░` with `█` as you complete items.

**Last action completed:** Docs round done (schema rewrite, README updates, orders Postman collection, 6 service READMEs) | **Date:** 2026-09-12

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
- [ ] Configure DLQ for `kitchen_queue`: messages that fail processing go to `kitchen_queue.dlq`
- [ ] Configure DLQ for `rider_queue`: messages that fail go to `rider_queue.dlq`
- [ ] Set up a DLQ consumer that logs/re-queues alerts

### 4.2 Add retry logic
- [ ] Implement retry with exponential backoff for DB operations
- [ ] For RMQ consumers: if processing fails, reject the message (it goes to DLQ after max retries)
- [ ] Consider using a simple retry wrapper or library (e.g., `p-retry`)

### 4.3 Add rate limiting
- [ ] Install `@nestjs/throttler` in orders-service
- [ ] Configure `ThrottlerModule` with sensible defaults (e.g., 10 requests/60 seconds per IP)
- [ ] This protects the public `POST /orders` endpoint from abuse

### 4.4 Add circuit breaker for inter-service calls
- [ ] Install `opossum` in orders-service
- [ ] Wrap item-service HTTP calls with circuit breaker
- [ ] Configure: 5 failures → open circuit for 30s → half-open → retry
- [ ] Return meaningful error when circuit is open (503 Service Unavailable)
- [ ] Add circuit breaker metrics/logging for observability

### 4.5 Add saga pattern (compensation)
- [ ] orders-service emits `order_created` with a saga ID
- [ ] If kitchen-service fails or rejects: emits `order_failed` with saga ID
- [ ] orders-service listens for `order_failed`, updates order status to `cancelled`
- [ ] Add `cancelled` status to order status enum
- [ ] Add compensation logging for observability
- [ ] Handle partial failures (e.g., kitchen succeeds but rider fails)

### 4.6 Harden Consul registration (ghost prevention)
- [ ] Point health-check URLs at the container hostname (`os.hostname()`), keep `Address` as the shared Compose name — dead incarnations go critical instead of borrowing successors' heartbeats
- [ ] Add `depends_on: consul (service_healthy)` in compose for deterministic boot ordering
- [ ] Add 60s re-registration heartbeat in `ConsulService` (unref'd timer, cleared in `onModuleDestroy`) + fake-timer unit tests per service — covers agent-amnesia, not ghosts
- [ ] Timed recreate test proving `onModuleDestroy` deregistration completes inside Docker's stop grace
- [ ] Ghost-scenario verification: recreate a container, old ID goes critical and is purged via `DeregisterCriticalServiceAfter` with zero manual calls

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
- [ ] All DTO classes in dedicated `dto/` directories
- [ ] All response types in dedicated `interfaces/` or `types/` directories

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
- [ ] Create `.github/workflows/ci.yml`:
  ```yaml
  name: CI
  on: [push, pull_request]
  jobs:
    test:
      runs-on: ubuntu-latest
      services:
        rabbitmq:
          image: rabbitmq:3-management
          ports: ['5672:5672']
      steps:
        - uses: actions/checkout@v4
        - uses: pnpm/action-setup@v4
        - uses: actions/setup-node@v4
          with: { node-version: 22 }
        - run: pnpm install
        - run: pnpm lint
        - run: pnpm test
        - run: pnpm build
  ```

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
- [ ] Build order history page (list of user's orders)
- [ ] Build order detail page with status timeline
- [ ] Poll orders-service for status updates (pending → cooking → dispatched → delivered)
- [ ] Show estimated time or status messages

### 6.6 UI polish
- [ ] Responsive design (mobile-first)
- [ ] Loading states and error handling
- [ ] Toast notifications for actions
- [ ] Clean, modern food delivery UI

---

## Phase 7 — Integration Testing

### 7.1 End-to-end flow tests
- [ ] Test full order flow: register → login → browse menu → place order → kitchen processes → rider dispatched
- [ ] Test auth flows: register, login, invalid credentials, token expiration
- [ ] Test menu browsing: list items, filter by category
- [ ] Test order placement: valid order, invalid item, missing address

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

## Reference: Critical Files & Line Numbers

| File | Line | Issue |
|------|------|-------|
| `main/orders-service/src/app.module.ts` | 5 | Unused `duration` import |
| `main/orders-service/src/app.module.ts` | 14 | Hardcoded `guest:guest` |
| `main/orders-service/src/app.service.ts` | 26 | RMQ emit not awaited |
| `main/orders-service/src/app.controller.ts` | 4-8 | DTO inline, no validation |
| `main/kitchen-service/src/main.ts` | 11, 18 | Hardcoded RMQ + typo |
| `main/kitchen-service/src/db/schema.ts` | 6 | `customName` vs `customerName` |
| `main/rider-service/src/main.ts` | 6, 14, 24 | Unused import + hardcoded RMQ + typo |
| All `tsconfig.json` | 21 | `noImplicitAny: false` |
| All `*.spec.ts` + `*.e2e-spec.ts` | various | Stale tests referencing `getHello()` |

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
*Last action completed: —*
