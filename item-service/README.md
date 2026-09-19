# item-service — SwiftBite

Menu categories and items. Port **3001**. Reads are public, writes need an admin JWT.

## Endpoints

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/categories` | no | full list |
| POST | `/categories` | admin | 409 on duplicate name |
| PATCH | `/categories/:id` | admin | rename |
| DELETE | `/categories/:id` | admin | cascades to its items |
| GET | `/items?category_id=` | no | optional category filter |
| GET | `/items/:id` | no | single item (used by orders-service for pricing) |
| POST | `/items` | admin | decimal prices allowed |
| PATCH | `/items/:id` | admin | partial update |
| DELETE | `/items/:id` | admin | historical orders keep snapshots |
| GET | `/health`, `/health/readiness` | no | liveness, DB reachability |

Interactive docs: http://localhost:3001/api

## Environment

| Var | Notes |
|-----|-------|
| `DATABASE_URL` | `item_db` connection string (least-privilege role) |
| `PORT` | default 3001 |
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

See [database-schema](../docs/database-schema.md) for `categories` and `menu_items`.
