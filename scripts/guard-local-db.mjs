#!/usr/bin/env bun
// Refuses to run the wrapped command unless DATABASE_URL points at a local database.
//
// `prisma migrate dev` (and anything else meant for local development, e.g. a future
// `migrate reset`) can drop/recreate data. Production only ever runs `prisma migrate
// deploy` (see package.json's `db:migrate:deploy` and docs/decisions/0010-prisma-
// migrations.md) — this script is the guard that keeps a `bun run db:migrate` invocation
// from accidentally running against a real database if a production `.env` ever ends up
// loaded in the wrong shell.
import 'dotenv/config';

const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[guard-local-db] DATABASE_URL is not set — refusing to run.');
  process.exit(1);
}

let host;
try {
  host = new URL(url).hostname;
} catch {
  console.error(`[guard-local-db] Could not parse DATABASE_URL as a URL — refusing to run.`);
  process.exit(1);
}

if (!ALLOWED_HOSTS.has(host)) {
  console.error(
    `[guard-local-db] DATABASE_URL host "${host}" is not a local database (expected one of: ${[...ALLOWED_HOSTS].join(', ')}).\n` +
      'This command is for local development only (see docker-compose.yml). ' +
      'Production must only ever run `bun run db:migrate:deploy` — never `db:migrate` — see docs/decisions/0010-prisma-migrations.md.',
  );
  process.exit(1);
}
