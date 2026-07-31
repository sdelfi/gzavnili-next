-- The DROP INDEX statements `prisma migrate diff` proposed here for the hand-added pg_trgm
-- GIN indexes (declared outside schema.prisma, so they always show up as drift — see
-- docs/decisions/0010-prisma-migrations.md) have been trimmed; they are not part of this
-- change.

-- AlterTable
ALTER TABLE "users" DROP COLUMN "agent_price",
ADD COLUMN     "agent_price" DECIMAL(10,2);
