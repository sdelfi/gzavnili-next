-- Restores the legacy `ParcelHistory` edit log, dropped in an earlier migration phase on a
-- mistaken premise. See docs/decisions/0018-parcel-edit-history.md.
--
-- NOTE (generated file, manually trimmed): `prisma migrate diff` proposed a `DROP INDEX` for
-- each of the 11 hand-added `pg_trgm` GIN indexes from the initial migration, which Prisma's
-- schema language can't express and therefore reports as drift on every generation. Those
-- lines were removed per docs/decisions/0010-prisma-migrations.md's standing policy.

-- CreateTable
CREATE TABLE "parcel_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "parcel_id" UUID NOT NULL,
    "edit_date_time" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edit_status" TEXT,
    "value_name" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "pay_method" TEXT,
    "pay_amount" DECIMAL(12,2),
    "updater_id" UUID,
    "updater_name" TEXT,

    CONSTRAINT "parcel_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "parcel_history_value_name_edit_date_time_idx" ON "parcel_history"("value_name", "edit_date_time");

-- CreateIndex
CREATE INDEX "parcel_history_parcel_id_edit_date_time_idx" ON "parcel_history"("parcel_id", "edit_date_time");

-- CreateIndex
CREATE INDEX "parcel_history_updater_id_edit_date_time_idx" ON "parcel_history"("updater_id", "edit_date_time");

-- AddForeignKey
ALTER TABLE "parcel_history" ADD CONSTRAINT "parcel_history_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcel_history" ADD CONSTRAINT "parcel_history_updater_id_fkey" FOREIGN KEY ("updater_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

