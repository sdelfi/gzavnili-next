-- The DROP INDEX statements `prisma migrate diff` proposed here for the hand-added pg_trgm
-- GIN indexes (not declared in schema.prisma, so they show up as drift) were removed per
-- docs/decisions/0010-prisma-migrations.md's documented policy — they aren't part of this
-- schema change.

-- CreateTable
CREATE TABLE "sms_queue" (
    "sms_queue_id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "phone_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_queue_pkey" PRIMARY KEY ("sms_queue_id")
);
