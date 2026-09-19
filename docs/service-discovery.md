# Service Discovery (Consul)

Consul is the service registry for SwiftBite. Every service registers itself on
startup with a name, address, and health check. Orders-service then discovers
item-service at request time instead of hardcoding its URL.

## Why

Microservices move. Containers get recreated with new IPs, replicas come and go.
Hardcoded URLs break the moment anything moves. The registry decouples the caller
from the callee's location: orders-service asks "where is item-service?" and
gets a live answer.

The cost is a moving part, so Consul is designed to degrade, never break. If the
registry is unreachable, services boot anyway and fall back to a static URL.

## How registration works

Each service runs the same `ConsulService` (`src/consul/consul.service.ts` in every
service):

1. **Register after `listen()`** in `main.ts`. The service must be answering requests
   before it advertises itself, otherwise the health check fails immediately.
2. **Service ID** is `name + hostname`. Two containers of the same service get
   distinct IDs, which is what stops them from overwriting each other.
3. **HTTP check** hits `/health` every 10 seconds. Consul only returns instances
   that pass this check to callers.
4. **`DeregisterCriticalServiceAfter: 1m`**. If a container dies and never
   deregisters (crash, kill -9), Consul purges its entry a minute after health
   checks start failing. This is what clears ghosts automatically.
5. **Deregister in `onModuleDestroy`**. Graceful shutdown removes the entry
   immediately, so healthy restarts leave no stale records.

Registration is fire and forget. On failure it logs a warning and moves on, because
a down registry should never take the whole service down.

## How discovery works

Only orders-service resolves at runtime, in `DiscoveryService`
(`src/consul/discovery.service.ts`):

1. **Lookup**: `GET consul:8500/v1/health/service/item-service?passing=1` returns
   only healthy instances.
2. **Random pick**: one instance is chosen per request, giving basic load
   spreading across replicas.
3. **10s cache**: the resolved URL is cached, so order traffic does not hammer
   Consul.
4. **Fallback**: any failure, empty result, or timeout returns
   `ITEM_SERVICE_URL` from env. Discovery outage degrades, never breaks.
5. **Invalidation**: when a call to the discovered URL fails at the network
   layer, the cache entry is dropped so the next call re-resolves.

## The `passing=1` filter

Without it, Consul would return instances that are registered but dead. The filter
requires health checks to be passing right now. Dead incarnations get filtered out
here and purged by `DeregisterCriticalServiceAfter` over time. Together they keep
callers away from corpses.

## Local setup

Consul runs as a dev agent in `docker-compose.yml`:

```yaml
consul:
  image: hashicorp/consul:latest
  command: agent -dev -ui -client=0.0.0.0
  ports:
    - '8500:8500'     # HTTP API + UI
    - '8600:8600/tcp'
    - '8600:8600/udp'
```

The dev agent runs single-node in-memory. Perfect for demos and tests; for real
deployment you would run a server cluster. `-dev` disables persistence, so a
restart wipes the catalog and services re-register on next boot.

## Inspecting it live

```bash
# All registered services
curl -s http://localhost:8500/v1/catalog/services

# Healthy item-service instances only
curl -s "http://localhost:8500/v1/health/service/item-service?passing=1"

# Watch the health checks (TABLING output, great for demos)
watch curl -s http://localhost:8500/v1/health/state/any

# UI
open http://localhost:8500/ui
```

## Configuration

| Var | Default | Used by |
|-----|---------|---------|
| `CONSUL_URL` | `http://localhost:8500` | registration + discovery |
| `SERVICE_NAME` | service name | registration (e.g. `orders-service`) |
| `SERVICE_ADDRESS` | service name | shared Compose hostname (see below) |
| `SERVICE_PORT` | `PORT` | port Consul health-checks |
| `ITEM_SERVICE_URL` | `http://localhost:3001` | discovery fallback in orders-service |

## Inside Docker vs local dev

In Docker Compose, services reach each other by container hostname, so
`SERVICE_ADDRESS` is the Compose service name (`item-service`) and the health
check URL works. On a plain local run each service registers with `localhost`.

Both register the same way. The difference is only what `SERVICE_ADDRESS` resolves
to, which is why it is configurable rather than hardcoded.

## Order flow with Consul

1. Customer checks out. `POST /orders` hits orders-service.
2. orders-service needs item prices, so it calls `DiscoveryService.getServiceUrl('item-service', ITEM_SERVICE_URL)`.
3. Consul returns a healthy item-service instance, cached for 10 seconds.
4. orders-service fetches each item, snapshots prices, saves the order.
5. If Consul is down: fallback URL is used, warning is logged, order still succeeds.

See [observability.md](./observability.md) for how an order's correlation ID traces
through the same services, and [docker-setup.md](./docker-setup.md) for the
troubleshooting checklist (ghost entries, empty catalog after restart).