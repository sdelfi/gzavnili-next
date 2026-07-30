import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

// Prisma 7 requires a driver adapter (no more built-in query-engine-binary + bare
// DATABASE_URL) — see docs/decisions/0010-prisma-migrations.md. Cached on `globalThis` in
// dev so Next's hot-reload doesn't spawn a fresh connection pool on every module reload.
declare global {
  var __prisma: PrismaClient | undefined;
}

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const db = globalThis.__prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = db;
}
