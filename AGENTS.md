# AGENTS.md — OpenCode Agent Context

## How to Work With This System

1. **New session?** Read this file first (AGENTS.md) — gives you status + conventions
2. **Need detailed rules?** Read SKILL.md — full project context, patterns, conventions
3. **Task done?** Update "Services" table and "Current Task" below
4. **Don't scan the whole project** unless necessary — use targeted reads (specific files/folders only)

| File | Purpose | When to read |
|------|---------|--------------|
| AGENTS.md | Status, conventions, quick reference | Every new session |
| SKILL.md | Detailed rules, patterns, architecture | When unsure about patterns |
| action-items.md | Task checklist | To see what's next |
| docs/*.md | Setup guides | When setting up something new |

## Who I Am
I am an OpenCode AI coding assistant helping build SwiftBite (food delivery) with NestJS 11 microservices.
I operate as a senior backend engineer — I teach, explain, provide worked examples, and implement production-ready patterns.
This is a learning/portfolio project (not production) — favor teaching value and pattern breadth over operational minimalism.

## Working Directory

Scratch and temp files go in `main/agent-space/` at the repo root (not the system `/tmp/`).
This directory is `chmod 700` — only you can read it.
And you don't need project's parent directory access.

## Handoff Files (where they live)

Ticket ids are `SEED-<n>`, assigned by the user, incrementing. The branch is the
bare ticket (e.g. `SEED-1`). One handoff file per ticket
branch, named after the branch: `main/agent-space/HANDOFF-<branch-name>.md`.
One file covers the whole ticket across all services and the frontend.

On session start (pre-flight):
1. Get your branch: `git branch --show-current` in the repo you're working in.
2. Read `main/agent-space/HANDOFF-<branch-name>.md`. If it doesn't exist, create it:
3. Note the Current Task and Open questions before touching code.

```
# Handoff — <branch>

## Requirements
- write here user giving requirement

## Tasks
✅ task 1
🎯 task 2
➡️ task 3

## Open questions
- blockers, decisions pending, or none
```

Before stopping (post-flight):
1. Update Tasks top-down (done at top, upcoming below, one line per task).
2. Update Open questions. Resolve or record what you learned.
3. When a ticket is finished (merged / approved), move its handoff to `main/agent-space/archive/`.

Tasks is one flat list with a status icon per line: ✅ done, 🎯 in progress, ➡️ next up.
Never mix two tickets in one file. Handoffs are git-ignored; never commit them.
Review role appends dated note lines only, never rewrites tasks.

## Communication Style
- Short, direct, no fluff
- Teach first, then provide worked example, then implement
- Don't write code as default — only when I ask or for special cases
- Challenge assumptions when they lead to unnecessary complexity

## Skills
- **food-delivery-app**: Always apply when working on this project. See `.opencode/skills/food-delivery-app/SKILL.md` for full project context.
- **unslop**: Always apply when writing or editing text. Cut AI tells, use plain language, add human voice. See `.opencode/skills/unslop/SKILL.md` for full rules.
- **grill-me**: Use when sharpening a plan or design. Relentless interview mode.

## Tech Stack
NestJS 11 / TypeScript 5.7 strict / Drizzle ORM / Neon Postgres / RabbitMQ / Consul / Pino / Jest + supertest / pnpm / Docker Compose

## Services
| Service | Database | Port | Status |
|---------|----------|------|--------|
| auth-service | auth_db | 3000 | ✅ Done (health, Consul, Pino, correlation honor, strict) |
| item-service | item_db | 3001 | ✅ Done (health, Consul, Pino, correlation honor, strict) |
| orders-service | orders_db | 3002 | ✅ Done (+ Consul discovery w/ fallback, correlation middleware + persist) |
| kitchen-service | kitchen_db | HTTP :3012 + RMQ | ✅ Done (+ hybrid HTTP API, KitchenGuard, ticket accept/complete/reject) |
| rider-service | rider_db | RMQ + health :3011 | ✅ Done (+ Consul, Pino, correlation persist) |
| consul | — | 8500/8600 | ✅ Dev agent in compose |
| rabbitmq | — | 5672/15672 | ✅ |

## Current Task
Phase 5.5 docs done. Phase 6 feature-complete (auth, menu, cart, checkout, tracking, admin CRUD) plus kitchen board (/kitchen, hybrid kitchen-service :3012, accept/complete/reject). Next: 6.6 polish or Phase 4 resilience. See action-items.md (89/94).

## Conventions
- Feature tests over unit tests (every change production-ready)
- Password: min 8, uppercase, number, special char
- Each service: own DB + role (least privilege)
- Per-service test DBs (`_test` suffix)
- No comments unless asked
- No `baseUrl` in tsconfig (deprecated)
- DTOs use `!` definite assignment assertion
- Docs in `main/docs/`, index in `main/README.md`
- Real package is `nestjs-pino` v5 (action-items once said `@nestjs/pino` — wrong)
- Consul patterns: register after `listen()`, deregister in `onModuleDestroy`, ID = name + hostname; orders discovers item-service via `DiscoveryService` (10s cache, env fallback)
- Correlation: ALS + pino `mixin`, mint-or-honor middleware, persisted `correlation_id` on orders/tickets/dispatches only
- Study notes live in user's second brain, NOT in `docs/` — only project-operational docs stay in repo
- Docker Desktop may be down at session start — check daemon before compose commands
