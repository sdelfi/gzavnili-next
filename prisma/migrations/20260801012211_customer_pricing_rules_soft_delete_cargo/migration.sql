-- Manually trimmed: `prisma migrate diff` also proposed DROP INDEX statements for the
-- hand-added pg_trgm GIN indexes (not declared in schema.prisma, so they show up as drift
-- on every diff — see docs/decisions/0010-prisma-migrations.md). Those lines were removed;
-- everything below is the actual intended change.

-- AlterEnum
ALTER TYPE "service_type" ADD VALUE 'cargo';

-- AlterTable
ALTER TABLE "customer_pricing_rules" ADD COLUMN     "deleted_at" TIMESTAMPTZ(6),
ADD COLUMN     "deleted_by" TEXT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;
