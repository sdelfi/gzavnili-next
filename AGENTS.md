<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Commit message rules

Do not add a `Co-Authored-By:` trailer (or any AI-attribution trailer) to commit
messages in this repo.

# Shared components

Reusable UI primitives (inputs, selects, buttons, and the like) belong in
`src/components/ui/`, not hand-rolled inline in whichever page/component
needs them first. Before writing a new `<input>`/`<select>`/etc., check
`src/components/ui/` for one that already fits, and extend it rather than
duplicating markup. If a pattern shows up in a second place, promote it to
`src/components/ui/` as part of that change.

# Routing

Every internal `href`/`action` goes through `src/lib/routes.ts`'s `routes`
helper (`routes.home()`, `routes.login()`, `routes.page("slug")` for a
static marketing page, etc.) instead of a literal path string. Add a new
named helper there when a route doesn't have one yet.

# Database schema/migrations

Never hand-write SQL that a proper tool should generate. Schema changes go through Prisma
(`prisma/schema.prisma` → `bun run db:migrate` locally, which wraps `prisma migrate dev` and
generates the migration file for you) — don't hand-author `CREATE TABLE`/`ALTER TABLE`/index
DDL that Prisma's schema diffing already produces correctly.

The only DDL that's ever hand-written is what Prisma's schema language genuinely cannot
express: trigger functions and `CHECK` constraints beyond simple ones. That goes in a
clearly-marked block appended to the end of the relevant generated migration file (see
`prisma/migrations/*/migration.sql`'s `-- ===` banner comment for the existing example) —
never scattered into ad hoc `.sql` scripts run by hand outside the migration history.

**Indexes are different from triggers**: Prisma's introspection does model indexes, so a
hand-added index not declared in `schema.prisma` (e.g. the `pg_trgm` GIN indexes) shows up
as drift and gets a `DROP INDEX` proposed for it on every future migration you generate.
When generating a new migration, always read the diff before applying it and manually
remove any `DROP INDEX` line targeting one of those — see
`docs/decisions/0010-prisma-migrations.md` for the full explanation and for the
`prisma migrate diff --from-migrations` workaround needed to generate a migration at all in
a non-interactive (agent) shell, since `prisma migrate dev` refuses to run in one.

Migration safety (see `docs/decisions/0010-prisma-migrations.md` for the full policy):
`bun run db:migrate` is local-only (guarded by `scripts/guard-local-db.mjs`); production only
ever runs `bun run db:migrate:deploy` (`prisma migrate deploy`) via `deploy.sh`, one command,
which never resets or drops data. Never run `prisma migrate reset`/`prisma db push` against
production — there is deliberately no script for either in `package.json`.

# Progress log

After any implementation work in this repo (features, fixes, refactors — not
one-off investigation), update `PROGRESS.md`: check off the step(s) completed,
and add new unchecked items for anything the work revealed as still
outstanding. Keep entries terse and reference the commit hash. Do this as part
of the same change, not as a separate follow-up.
