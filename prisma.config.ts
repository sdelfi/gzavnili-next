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
  },
});
