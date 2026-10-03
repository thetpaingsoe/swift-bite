# Database Setup

Single Neon project, five databases — one per service.

## 1. Create databases and roles

In your Neon dashboard, create a database and role for each service:

| Database | Role | Service |
|----------|------|---------|
| `auth_db` | `auth_role` | auth-service |
| `item_db` | `item_role` | item-service |
| `orders_db` | `orders_role` | orders-service |
| `kitchen_db` | `kitchen_role` | kitchen-service |
| `rider_db` | `rider_role` | rider-service |

Or via SQL editor:

```sql
CREATE ROLE auth_role WITH LOGIN PASSWORD 'your_password';
CREATE DATABASE auth_db OWNER auth_role;

CREATE ROLE item_role WITH LOGIN PASSWORD 'your_password';
CREATE DATABASE item_db OWNER item_role;

CREATE ROLE orders_role WITH LOGIN PASSWORD 'your_password';
CREATE DATABASE orders_db OWNER orders_role;

CREATE ROLE kitchen_role WITH LOGIN PASSWORD 'your_password';
CREATE DATABASE kitchen_db OWNER kitchen_role;

CREATE ROLE rider_role WITH LOGIN PASSWORD 'your_password';
CREATE DATABASE rider_db OWNER rider_role;
```

## 2. Connection URL format

Use the role matching each service:

```
postgresql://auth_role:password@ep-xxx-region.aws.neon.tech/auth_db?sslmode=require
```

Each service gets its own role and database name in the URL.

## 3. Configure each service

Copy `.env.example` to `.env` in each service folder and fill in your `DATABASE_URL`:

```bash
cp auth-service/.env.example auth-service/.env
cp item-service/.env.example item-service/.env
cp orders-service/.env.example orders-service/.env
cp kitchen-service/.env.example kitchen-service/.env
cp rider-service/.env.example rider-service/.env
```

> Docker Compose does **not** use these files — it reads the root `main/.env`
> (`AUTH_DATABASE_URL`, `ITEM_DATABASE_URL`, …). Per-service `.env` files are for
> local development (`pnpm start:dev`) and running migrations outside Docker.

Example for auth-service:
```
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/auth_db?sslmode=require
PORT=3000
JWT_SECRET=your-random-secret-here
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

## 4. Generate JWT secret

auth-service requires a `JWT_SECRET` to sign tokens. Generate one:

```bash
openssl rand -base64 32
```

Paste the output into your auth-service `.env` as `JWT_SECRET`. This is not a password — it's a random string that signs JWT tokens so no one can forge them. If it leaks, anyone can create valid tokens.

## 5. Run migrations

Each service has its own Drizzle schema. Generate and apply migrations per service:

```bash
cd auth-service
pnpm db:generate
pnpm db:migrate
```

Repeat for each service after its schema is created.

Workflow: edit `src/db/schema.ts` → `db:generate` (review the emitted SQL — always
read it) → migrate test DBs first (`db:migrate:test`), then prod (`db:migrate`).
Rollback is a new migration, never edit an applied one. See
[database-schema.md](./database-schema.md) for the current tables.

## 6. Tables created per service

| Service | Table | Purpose |
|---------|-------|---------|
| auth-service | `users` | id, name, email, password_hash, role, created_at |
| item-service | `categories`, `menu_items` | menu catalog + items |
| orders-service | `orders`, `order_items` | order header + per-line snapshots, status, ready_at, kitchen_notified, correlation_id |
| kitchen-service | `tickets` | id, order_id, line snapshots, contact, status, correlation_id |
| rider-service | `dispatches` | id, order_id, line snapshots, contact, status, correlation_id |

Full column list and relationships: [database-schema.md](./database-schema.md).

## Notes

- **Never commit `.env` files.** They're gitignored by default.
- Each service owns its database — no cross-service direct DB access.
- Use the Neon SQL editor to manually inspect data when debugging.
- See [test-setup.md](./test-setup.md) for test database setup and running tests.
