# Docker Setup

Run all services locally with Docker Compose.

## Prerequisites

- Docker Desktop installed and running
- `.env` file with your database URLs (see [database-setup.md](./database-setup.md))

## 1. Configure environment

Copy the example env file and fill in your Neon database URLs:

```bash
cd main
cp .env.example .env
```

Edit `.env` with your actual connection strings:

```
AUTH_DATABASE_URL=postgresql://auth_role:password@ep-xxx.aws.neon.tech/auth_db?sslmode=require
ITEM_DATABASE_URL=postgresql://item_role:password@ep-xxx.aws.neon.tech/item_db?sslmode=require
ORDERS_DATABASE_URL=postgresql://orders_role:password@ep-xxx.aws.neon.tech/orders_db?sslmode=require
KITCHEN_DATABASE_URL=postgresql://kitchen_role:password@ep-xxx.aws.neon.tech/kitchen_db?sslmode=require
RIDER_DATABASE_URL=postgresql://rider_role:password@ep-xxx.aws.neon.tech/rider_db?sslmode=require
```

## 2. Start all services

```bash
docker-compose up --build -d
```

The `--build` flag builds images before starting. First run takes a few minutes.

This starts:

| Service | Port | Purpose |
|---------|------|---------|
| rabbitmq | 5672, 15672 | Message broker |
| consul | 8500, 8600 | Service discovery (API/UI + DNS) |
| auth-service | 3000 | User registration/login |
| item-service | 3001 | Menu browsing |
| orders-service | 3002 | Order placement |
| kitchen-service | 3010 | RMQ consumer, health endpoint only |
| rider-service | 3011 | RMQ consumer, health endpoint only |

## 3. Verify services are running

```bash
docker-compose ps
```

All services should show `Up` status.

Check health endpoints:

```bash
# Liveness (is process alive?)
curl http://localhost:3000/health
curl http://localhost:3001/health
curl http://localhost:3002/health

# Readiness (is DB + RMQ reachable?)
curl http://localhost:3000/health/readiness
curl http://localhost:3002/health/readiness

# Kitchen/Rider health (separate ports)
curl http://localhost:3010/health
curl http://localhost:3011/health
```

## 4. View logs

```bash
# All services
docker-compose logs -f

# Single service
docker-compose logs -f orders-service

# RabbitMQ management UI
open http://localhost:15672
# Login: guest / guest
```

## 5. Stop services

```bash
docker-compose down
```

Add `-v` to also remove volumes (resets RabbitMQ):

```bash
docker-compose down -v
```

## 6. Rebuild after code changes

```bash
docker-compose up --build -d
```

Or rebuild a single service:

```bash
docker-compose up --build -d orders-service
```

## Project structure

```
main/
├── docker-compose.yml
├── auth-service/
│   ├── Dockerfile
│   └── ...
├── item-service/
│   ├── Dockerfile
│   └── ...
├── orders-service/
│   ├── Dockerfile
│   └── ...
├── kitchen-service/
│   ├── Dockerfile
│   └── ...
└── rider-service/
    ├── Dockerfile
    └── ...
```

Each service has its own `Dockerfile`. The `docker-compose.yml` at the root orchestrates everything.

## Service discovery (Consul)

All 5 services self-register with Consul on startup (ID = service name + container
hostname) with HTTP health checks against their `/health` endpoints, and deregister on
shutdown. Browse the registry at http://localhost:8500 (Services tab).

See [service-discovery.md](./service-discovery.md) for how registration and
discovery work under the hood.

- `orders-service` discovers `item-service` dynamically via
  `GET consul:8500/v1/health/service/item-service?passing=1` (10s cache, random pick).
  If Consul is unreachable it falls back to `ITEM_SERVICE_URL` — directory outage
  degrades, never breaks.
- RabbitMQ traffic still uses Docker DNS (`rabbitmq:5672`).

Check the catalog:

```bash
# All registered services
curl -s http://localhost:8500/v1/catalog/services

# Healthy item-service instances only
curl -s "http://localhost:8500/v1/health/service/item-service?passing=1"
```

## Logging

All services log single-line JSON in production (pretty locally, silent in tests).
Trace one order across every service with its correlation ID:

```bash
# Place an order with a known ID, then follow it everywhere
curl -X POST http://localhost:3002/orders \
  -H 'Content-Type: application/json' -H 'x-correlation-id: debug-1' \
  -d '{"customerName":"...","menuItemId":"...","quantity":1,"street":"...","area":"..."}'

docker-compose logs --no-log-prefix | grep "debug-1"
```

See [observability.md](./observability.md) for the full correlation-ID design.

## Troubleshooting

**Service won't start:**
```bash
docker-compose logs orders-service
```

**RabbitMQ not ready:**
Wait 10-15 seconds after `docker-compose up`. The health check waits for RabbitMQ to be ready before starting services.

**Connection refused:**
Ensure `.env` has the correct database URLs and RabbitMQ is running:

```bash
docker-compose ps rabbitmq
curl http://localhost:15672
```

**Port conflicts:**
If ports 3000-3002 or 3010-3011 are in use, stop local processes or change ports in `docker-compose.yml`.

**Empty Consul catalog after restart:**
Services register once at boot — if they booted while Consul was down they stay
unregistered (boot never fails on directory outage, by design). Restart them:

```bash
docker-compose restart auth-service item-service orders-service kitchen-service rider-service
```

**Duplicate (ghost) entries in Consul:**
Recreated containers get new hostnames → new IDs; if the old container's
deregistration didn't complete, its entry lingers. Compare catalog IDs against live
hostnames, then remove the stale one:

```bash
docker inspect --format '{{.Name}} {{.Config.Hostname}}' $(docker-compose ps -q)
curl -X PUT http://localhost:8500/v1/agent/service/deregister/<stale-id>
```

**Orders work with Consul stopped:**
Expected — orders-service falls back to `ITEM_SERVICE_URL`. Check the logs for
`Discovery fallback for item-service` to confirm the fallback path engaged.
