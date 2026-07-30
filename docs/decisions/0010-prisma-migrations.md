# 0010 — Prisma for schema/migrations; Postgres reconfirmed over MySQL; migration safety policy

## Context

This is the Phase 1 implementation ([docs/migrations/06-phased-rollout-plan.md](../migrations/06-phased-rollout-plan.md)): standing up the redesigned parcels-domain Postgres schema from [docs/migrations/04-postgres-schema-design.md](../migrations/04-postgres-schema-design.md). [docs/migrations/03-target-architecture.md](../migrations/03-target-architecture.md) §6 explicitly deferred the ORM/query-builder choice to this point.

## Postgres vs. MySQL — reconfirmed, not assumed

`docker-compose.yml`/`README.md` already assumed Postgres from an earlier session, before the client had explicitly weighed in. The client's stated default preference is actually MySQL, since they operate the production database directly on the host themselves and are more familiar with it operationally. This was raised and resolved explicitly during Phase 1 implementation:

- **Postgres-specific wins that matter for this exact redesign**: trigram (`pg_trgm`) GIN indexes directly solve the leading-wildcard `LIKE '%...%'` search problem cited in [04-postgres-schema-design.md](../migrations/04-postgres-schema-design.md) §4 (today, zero index support exists for these searches); partial indexes (e.g. `WHERE status = 'on_hold'`) have no MySQL equivalent at all, at any version. Prisma's Postgres connector is also the more mature of the two.
- **Where it doesn't matter**: the actual core fix — a maintained `status` column plus trigger-denormalized `is_paid`/`office_name`/`user_balances` (§1 of the schema design doc — the actual thing solving the client's slow-`getParcels()` pain point) — works essentially the same on MySQL. Nothing in this schema depends on a Postgres-only trigger capability.
- **Where MySQL would have won**: the client's own operational familiarity running the DB on their host in production — a legitimate factor, arguably heavier than the trigram-search win, since that win could also be achieved later a different way (MySQL `ngram` fulltext, a dedicated search service, or simply confirmed unnecessary — see §5 of the schema doc, "evaluate, don't assume").

**Decision: keep Postgres.** Confirmed explicitly with the client during Phase 1 implementation, after being presented with the trade-off above — not decided unilaterally.

## ORM: Prisma 7

Chosen at Phase 1 implementation time (deferred from [03-target-architecture.md](../migrations/03-target-architecture.md) §6, which named Prisma/Drizzle/raw `pg` as candidates without picking one). Prisma 7 specifics that affect this codebase:

- The default generator is now `prisma-client` (not the old `prisma-client-js`), requires an explicit `output` path (`src/generated/prisma`, gitignored, regenerated via `postinstall`/`bun run db:generate` — never commit it), and `importFileExtension = ""` for bundler (Next.js) compatibility.
- Datasource URL no longer lives in `schema.prisma` — it's read from `prisma.config.ts` (`datasource.url`, sourced from `process.env.DATABASE_URL` via `dotenv/config`).
- `PrismaClient` now requires an explicit driver adapter — no more built-in query-engine-binary talking directly to a bare connection string. This project uses `@prisma/adapter-pg` (see `src/lib/db.ts` for the singleton, cached on `globalThis` in dev to survive Next's hot-reload without exhausting the connection pool).

## Schema/triggers not expressible in `schema.prisma`

Prisma's DSL has no way to declare trigger functions, `CHECK` constraints beyond simple ones, or trigram-with-operator-class indexes. These live as hand-written raw SQL appended to the end of the initial migration (`prisma/migrations/<ts>_init/migration.sql`, everything after the `-- ===` banner comment) — specifically:

- `fn_recompute_parcel_status()` + `trg_parcels_recompute_status` (`BEFORE INSERT OR UPDATE` on `parcels`) — the single authoritative status computation, replacing the 8-10 drifted copies documented in [02-parcels-domain-analysis.md](../migrations/02-parcels-domain-analysis.md) §7.
- `fn_log_parcel_status_history()` + `trg_parcels_log_status_history` (`AFTER INSERT OR UPDATE`) — the append-only audit trail.
- `fn_sync_parcel_office_name()` / `fn_sync_office_name_on_rename()` — denormalized `parcels.office_name`, kept in sync from `parceloffice` assignment changes and `delivery_offices` renames.
- `fn_sync_parcel_invoice_denorm()` / `fn_sync_parcels_on_invoice_date_change()` — denormalized `is_paid`/`is_invoiced`/`invoice_id`/`invoice_amount`.
- `fn_sync_user_balance()` (+ trigger wrappers on `payments`, `invoices`, `invoices_items`) — the user-level `paid_amount`/`invoice_amount`/`balance` aggregate, the single worst offender identified in [02-parcels-domain-analysis.md](../migrations/02-parcels-domain-analysis.md) §2.2.
- `pg_trgm` extension + GIN trigram indexes on `addressbook`(organization/first_name/last_name/phone1/city/state) and `parcels`(awb/tracking_num/tracking_num2).
- A `CHECK ("id" = 1)` constraint on `config`, enforcing the single-row invariant together with its existing primary key.

This hand-written block is **not** re-derived by future `prisma migrate dev` runs — Prisma only diffs the tables/columns/indexes/enums that exist in `schema.prisma`; everything else is replayed as-is from migration history (including on a from-scratch reset of a dev/shadow database), so a future auto-generated migration can't silently drop it.

**Provisional status-priority order** (see the enum's doc-comment in `schema.prisma` and `fn_recompute_parcel_status`'s own comment): hold flags win first, matching the bema admin list query. The legacy single-parcel `read()` endpoint checks `delivered` before the hold flags instead — [docs/migrations/07-risks-and-open-questions.md](../migrations/07-risks-and-open-questions.md) open question #1 flags this as still requiring explicit client sign-off. If that decision comes back the other way, `fn_recompute_parcel_status` is the only place that needs to change.

## Migration safety policy — never wipe production

This is the client's explicit, non-negotiable requirement. The policy:

- **Local development**: `bun run db:migrate` (wraps `prisma migrate dev`). Guarded by `scripts/guard-local-db.mjs`, which parses `DATABASE_URL` and refuses to run unless the host is `localhost`/`127.0.0.1`/`::1` — i.e. the `docker-compose.yml` Postgres instance. This exists so a production `.env` accidentally loaded in the wrong shell can't trigger a dev-only migration command against the wrong database. `bun run db:studio` is guarded the same way, since a stray edit through Studio against production would be just as bad.
- **Production**: the **only** sanctioned command is `bun run db:migrate:deploy` (`prisma migrate deploy`). It applies pending migration files in order, inside a transaction with a Postgres advisory lock, and — critically — **never** generates a new migration, never runs drift detection, and never resets anything. There is deliberately no `db:push` or `db:reset` script in `package.json`, to avoid an easy accidental invocation of either against production.
- **`prisma migrate reset` / `prisma db push --force-reset` must never be run against production.** As a second, independent safety net (not the primary control — the primary control is the policy above): Prisma 7 itself detects when it's invoked by an AI coding agent and refuses to run either command without an explicit human-provided `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` environment variable containing the literal text of the user's consent message. This was exercised for real during this implementation pass (twice — once misapplied, then correctly, after the human explicitly confirmed the target was the local docker-compose database, not production).
- Recommended (not yet automated): a `pg_dump` backup immediately before any production `db:migrate:deploy` run, since even a non-destructive-by-design `migrate deploy` can still carry a DDL change with real consequences (e.g. a dropped column) if a migration was authored incorrectly.
