-- AlterEnum
ALTER TYPE "admin_role" ADD VALUE 'bema_content_only';

-- The DROP INDEX statements `prisma migrate diff` proposed here for the hand-added pg_trgm
-- GIN indexes (not declared in schema.prisma, so they show up as drift) were removed per
-- docs/decisions/0010-prisma-migrations.md's documented policy — they aren't part of this
-- schema change.
