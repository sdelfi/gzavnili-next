-- The DROP INDEX statements `prisma migrate diff` proposed here for the hand-added pg_trgm
-- GIN indexes (not declared in schema.prisma, so they show up as drift) were removed per
-- docs/decisions/0010-prisma-migrations.md's documented policy — they aren't part of this
-- schema change.

-- AlterTable
ALTER TABLE "message_types" ADD COLUMN     "operation" TEXT;

-- AlterTable
ALTER TABLE "operations" ADD COLUMN     "customer_phone_formatted" TEXT,
ADD COLUMN     "customer_phone_raw" TEXT,
ADD COLUMN     "notify_result_code" INTEGER,
ADD COLUMN     "receiver_id_at_send" UUID,
ADD COLUMN     "receiver_phone_formatted" TEXT,
ADD COLUMN     "receiver_phone_raw" TEXT,
ADD COLUMN     "sent_at" TIMESTAMPTZ(6),
ADD COLUMN     "sent_notification" BOOLEAN,
ADD COLUMN     "sent_sms" BOOLEAN;

-- AlterTable
ALTER TABLE "parcels" ADD COLUMN     "b_customer_sms" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "b_sent_on_hold" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "message_types_operation_key" ON "message_types"("operation");

-- CreateIndex
CREATE INDEX "operations_sent_notification_sent_sms_operation_time_idx" ON "operations"("sent_notification", "sent_sms", "operation_time");
