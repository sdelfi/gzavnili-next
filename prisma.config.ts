import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7 reads the datasource URL from here, not from schema.prisma, and this file is
// also what `prisma migrate deploy`/`dev` consult for the migrations directory — see
// docs/decisions/0010-prisma-migrations.md for the local-vs-production safety rules around
// which of those two commands is allowed to run against which DATABASE_URL.
export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
    // Only needed for `prisma migrate diff --from-migrations` (used to non-interactively
    // regenerate a migration in environments without a real TTY — `prisma migrate dev`
    // normally creates/drops its own throwaway shadow DB automatically and doesn't need
    // this set). Local dev only; not used in production (`migrate deploy` never needs a
    // shadow database).
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
