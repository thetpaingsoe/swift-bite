# auth-service — SwiftBite

User registration, login, and JWT verification. Port **3000**.

## Endpoints

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/auth/register` | no | name, email, password (min 8, upper, number, special); always creates `customer` |
| POST | `/auth/login` | no | returns id, name, email, role, token |
| GET | `/auth/verify` | Bearer | returns userId, email, role; used by other services' guards |
| GET | `/health` | no | liveness |
| GET | `/health/readiness` | no | DB reachability |

Interactive docs: http://localhost:3000/api

## Environment

| Var | Notes |
|-----|-------|
| `DATABASE_URL` | `auth_db` connection string (least-privilege role) |
| `PORT` | default 3000 |
| `JWT_SECRET` | signing secret, shared with no one (only this service signs) |
| `JWT_EXPIRES_IN` | default `7d` |
| `NODE_ENV` | `development` pretty logs, `production` JSON logs |

## Scripts

```bash
pnpm install
pnpm db:generate   # new migration from schema
pnpm db:migrate    # apply migrations
pnpm db:seed       # 4 test users (admin, kitchen, rider, customer)
pnpm start:dev
pnpm build
```

See [database-setup](../docs/database-setup.md) for Neon databases and
[database-schema](../docs/database-schema.md) for the `users` table.
