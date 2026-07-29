# 0004 — Scheduled jobs: OS cron for simple sweeps, BullMQ (plain Redis, no modules) for the rest

**Status:** confirmed, supersedes the "Vercel Cron" suggestion in
[`migrations/03-target-architecture.md`](../migrations/03-target-architecture.md) §4 (written
before hosting was pinned down) and the earlier draft of this file (which proposed a
Postgres-backed queue instead of BullMQ — revised after explicit client direction below).

## Constraint: no third-party services

**Everything runs on our own VDS, self-managed. No Vercel, no managed queue/cron SaaS, no
external platform dependency of any kind.** Whatever we pick has to run as a process/container
we operate ourselves (Docker is fine).

## Does Next.js have a scheduling mechanism?

No. Next.js is a request/response web framework — it has no built-in timer, queue, or "run this
every hour" primitive, regardless of hosting. Anything scheduled comes from outside the Next.js
process. This isn't a reason to split into a monorepo either (see
[0001](0001-no-monorepo.md)/[0003](0003-mobile-api.md)) — the scheduler/worker is an operational
concern (what process runs it, on what timer), not a reason to relocate the job code into a
separate deployable package; it can still import the same app code.

## Decision

- **Simple periodic sweeps** (`onhold.cfm`, `changeParcelStatus.cfm` — plain "run this SQL/
  function every N minutes", per §4 of the target-architecture doc): an **OS crontab entry** on
  the VDS running a small script directly (e.g. `bun run scripts/cron/change-parcel-status.ts`),
  importing the same DB/query code the app uses. No queue infrastructure needed for these.
- **Jobs needing retries/backpressure/observability** (SMS sends, batch status recomputation):
  **BullMQ**, backed by a plain self-hosted Redis container — no Redis modules/plugins.

## Why BullMQ specifically, and why plain Redis is fine

The explicit concern raised: we were burned before by RedisGraph — a Redis *module* that got
deprecated, which blocked both upgrading Redis (newer versions dropped support for the module)
and migrating to a managed Redis (AWS ElastiCache doesn't let you install custom modules). The
lesson isn't "avoid Redis" — it's **avoid anything that depends on Redis modules/plugins**,
because module support is exactly the thing you can't control or migrate away from later.

BullMQ doesn't have that problem: it's implemented entirely on top of Redis's **core data
structures and Lua scripting** (lists, sorted sets, hashes, pub/sub — all present in Redis since
version 2-6, no `MODULE LOAD` involved). It runs unmodified against stock `redis:7` (or any
Redis-protocol-compatible server), self-hosted in Docker here. It's the most widely used Node.js
job queue (retries, backoff, concurrency, delayed/repeatable — including cron-pattern —  jobs,
dead-letter handling, and an optional dashboard via Bull Board), so this is the mature,
battle-tested choice the client asked for, not a Postgres-backed alternative chosen to dodge
adding Redis — the constraint was "no plugins," not "no Redis."

## How to apply

When Phase 6 (cron migration, `06-phased-rollout-plan.md`) starts:
- Simple sweeps → `scripts/cron/*.ts` + VDS crontab entries.
- Queue-worthy jobs → BullMQ queues/workers, `docker-compose.yml` gets a plain `redis:7-alpine`
  service (or similar), worker process runs under `systemd`/`pm2` alongside the Next.js server.
- Log every run somewhere queryable (a `job_runs` table or similar) — the legacy cron jobs
  currently fail silently in places; don't repeat that.
