# gzavnili-next

Next.js rewrite of gzavnili.com. See [`docs/`](docs/README.md) for the full migration plan,
current-state audit, and target architecture — this project is the Phase 2+ implementation
target described there. Live legacy site (source of truth for current behavior/design):
https://usa.gzavnili.com/

## Local development

Runtime: [bun](https://bun.sh). Infra dependencies (Postgres, and later Redis if needed)
run in Docker locally.

```bash
docker compose up -d      # starts local Postgres (see docker-compose.yml)
cp .env.example .env      # DATABASE_URL points at the docker-compose Postgres by default
bun install                # also runs `prisma generate` (postinstall)
bun run db:migrate         # applies prisma/migrations/ to the local database
bun dev                   # http://localhost:3000
```

## Database (Prisma + Postgres)

See [`docs/decisions/0010-prisma-migrations.md`](docs/decisions/0010-prisma-migrations.md) for
the full rationale (Postgres vs. MySQL, Prisma 7 specifics, why some of the schema is
hand-written SQL) and the migration safety policy. Summary:

- `bun run db:migrate` — local development only. Guarded (`scripts/guard-local-db.mjs`)
  to refuse to run unless `DATABASE_URL` points at `localhost`.
- `bun run db:migrate:deploy` — the **only** command production ever runs. Applies
  pending migrations; never generates one, never resets, never touches data destructively
  by itself.
- `bun run db:studio` — same local-only guard as `db:migrate`.
- **Never** run `prisma migrate reset` or `prisma db push` against production. There is no
  `db:reset`/`db:push` script in `package.json`, intentionally.

## Production

- App runtime: managed via HestiaCP's Node.js app proxy (reverse-proxied) + PM2, not Docker.
- Database: intended to run directly on the host (not containerized) — see `.env` on the
  server for the actual `DATABASE_URL`. Migrations are applied with
  `bun run db:migrate:deploy` only — see "Database" above.
- Any additional infra (Redis, queues, etc.) — containerized on the host if/when introduced,
  same as local dev.
- **Deploy is one command**: `./deploy.sh` — pulls, installs (which also runs
  `prisma generate`), runs `bun run db:migrate:deploy`, builds, and restarts the PM2
  process. This is the single entrypoint a future GitHub webhook/CI job should call on the
  server; nothing about the deploy flow needs to grow beyond calling this one script.

## Stack

- Next.js (App Router), TypeScript — no Tailwind; legacy CSS (`http/css/*`) ported as-is,
  see `docs/decisions/`
- Postgres
- Package manager / runtime: bun
- No separate backend service / no monorepo split: the API layer is Next.js Route Handlers
  in this same app (decision recorded in `docs/migrations/03-target-architecture.md` §2 and
  `docs/decisions/0001-no-monorepo.md`)
