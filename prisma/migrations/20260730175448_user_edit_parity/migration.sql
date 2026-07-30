-- CreateEnum
CREATE TYPE "service_type" AS ENUM ('regular', 'express');

-- CreateEnum
CREATE TYPE "pricing_rule_mode" AS ENUM ('fixed_price', 'discount');

-- Only `addressbook_phone1_trgm_idx` is a real drop here (its column is being dropped
-- below) — the other 8 were the same false-positive drift already documented in
-- docs/decisions/0010-prisma-migrations.md (hand-added trigram indexes aren't declared in
-- schema.prisma, so `prisma migrate diff` always proposes dropping them). Trimmed by hand
-- again, same as the previous migration.
-- DropIndex
DROP INDEX "addressbook_phone1_trgm_idx";

-- AlterTable
ALTER TABLE "addressbook" DROP COLUMN "phone1",
DROP COLUMN "phone2",
DROP COLUMN "phone3",
ADD COLUMN     "cell_phone" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "fax" TEXT,
ADD COLUMN     "home_phone" TEXT,
ADD COLUMN     "private_number" TEXT,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "work_phone" TEXT;

-- AlterTable
ALTER TABLE "config" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "import_id" TEXT,
ADD COLUMN     "notify_via_mail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notify_via_sms" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shipping_address_id" UUID;

-- CreateTable
CREATE TABLE "message_types" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "message_types_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "customer_pricing_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "service_type" "service_type" NOT NULL,
    "mode" "pricing_rule_mode" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "customer_pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_UserNotificationPreferences" (
    "A" TEXT NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_UserNotificationPreferences_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "customer_pricing_rules_user_id_idx" ON "customer_pricing_rules"("user_id");

-- CreateIndex
CREATE INDEX "_UserNotificationPreferences_B_index" ON "_UserNotificationPreferences"("B");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_shipping_address_id_fkey" FOREIGN KEY ("shipping_address_id") REFERENCES "addressbook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_pricing_rules" ADD CONSTRAINT "customer_pricing_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserNotificationPreferences" ADD CONSTRAINT "_UserNotificationPreferences_A_fkey" FOREIGN KEY ("A") REFERENCES "message_types"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserNotificationPreferences" ADD CONSTRAINT "_UserNotificationPreferences_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================================================
-- Hand-written (see docs/decisions/0010-prisma-migrations.md): trigram search support for
-- the phone fields that replaced `phone1` (dropped above along with its trgm index).
-- =====================================================================================
CREATE INDEX "addressbook_private_number_trgm_idx" ON "addressbook" USING gin ("private_number" gin_trgm_ops);
CREATE INDEX "addressbook_cell_phone_trgm_idx" ON "addressbook" USING gin ("cell_phone" gin_trgm_ops);

