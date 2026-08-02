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

## Parcels performance benchmark

[`scripts/benchmark-parcels.ts`](scripts/benchmark-parcels.ts) seeds a realistic parcels
dataset and measures the real parcels list, Parcels Reports, and Parcels Reports 2 API
endpoints. Run it only against a disposable local or benchmark database, never production.

First ensure `.env` contains the target `DATABASE_URL`. When using `--reset`, it must also
contain `BEMA_SEED_USERNAME`: that administrator and its linked profile data are preserved
while the benchmark tables are cleared. The database name passed to `--confirm` must exactly
match the database name at the end of `DATABASE_URL`.

```bash
# Destructively clear benchmark tables, preserve BEMA_SEED_USERNAME, then seed 200k parcels.
bun scripts/benchmark-parcels.ts --reset --seed --confirm=gzavnili

# For a quicker local run, reduce the dataset (the default is 200000; the full test is 1M).
bun scripts/benchmark-parcels.ts --reset --seed --scale=50000 --confirm=gzavnili

# Start the application in another terminal, then measure the real HTTP endpoints.
bun dev
bun scripts/benchmark-parcels.ts --bench

# Optionally save machine-readable results for comparison.
bun scripts/benchmark-parcels.ts --bench --json=benchmark-results.json

# Clear benchmark data without reseeding; BEMA_SEED_USERNAME is still preserved.
bun scripts/benchmark-parcels.ts --reset --confirm=gzavnili
```

`--seed` validates that it created eligible report rows and fails instead of leaving an
empty Reports 2 fixture. More detail and the baseline measurements are recorded in
[`docs/decisions/0016-parcels-performance.md`](docs/decisions/0016-parcels-performance.md).

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

## Scheduled jobs

See [`docs/decisions/0004-scheduled-jobs.md`](docs/decisions/0004-scheduled-jobs.md) for the
full rationale and [`docs/decisions/0026-cron-phase6.md`](docs/decisions/0026-cron-phase6.md)/
[`docs/decisions/0027-cron-notifications.md`](docs/decisions/0027-cron-notifications.md) for
the ported jobs themselves. Two kinds, and **adding a new one needs a deployment step beyond
just writing the code**:

- **Simple sweeps** (`scripts/cron/*.ts`) — no queue, no retries, one process per run. Each
  needs its own **VDS crontab entry** running `bun run scripts/cron/<name>.ts` on legacy's
  original interval (see the file's own header comment for the source interval). Currently:
  `onhold.ts`, `change-parcel-status.ts`, `onhold-sms.ts`, `customer-received-sms.ts`,
  `linoli-report.ts`.
- **Queue-worthy jobs** (outbound SMS/gateway calls, needing retries/backpressure) — BullMQ,
  registered in **`scripts/worker.ts`**, one long-running process (managed by `systemd`/`pm2`
  alongside the Next.js server, not a crontab entry) that schedules and runs every queue-worthy
  job's worker. Currently: the `sms_queue` drain (every 180s) and the notification engine
  (`cron/sendMessages.cfm`'s port, every 600s). Adding one means registering its
  queue/worker/scheduler in `scripts/worker.ts`, not a new crontab line.

Every job (either kind) logs a `JobRun` row via `src/lib/jobs/runJob.ts` — check that table
first when a scheduled job's behavior is in question, rather than only tailing process logs.

**Checklist for porting a new legacy `cron/*.cfm` file:** decide sweep vs. queue-worthy per
0004's criteria, write the job under `scripts/cron/` or as a new BullMQ worker, wrap it in
`runJob(...)`, and then — the step it's easy to forget — either add the VDS crontab entry or
register it in `scripts/worker.ts`. A job with code but no crontab entry/worker registration
silently never runs in production.

## Stack

- Next.js (App Router), TypeScript — no Tailwind; legacy CSS (`http/css/*`) ported as-is,
  see `docs/decisions/`
- Postgres
- Package manager / runtime: bun
- No separate backend service / no monorepo split: the API layer is Next.js Route Handlers
  in this same app (decision recorded in `docs/migrations/03-target-architecture.md` §2 and
  `docs/decisions/0001-no-monorepo.md`)
