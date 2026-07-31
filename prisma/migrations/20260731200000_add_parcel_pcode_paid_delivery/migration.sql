-- Generated with `prisma migrate diff --from-schema <previous schema.prisma> --to-schema
-- prisma/schema.prisma --script` (no database needed) rather than the `--from-migrations`
-- form documented in docs/decisions/0010-prisma-migrations.md: this environment has no
-- Postgres to act as the shadow database. Diffing two schema files also means the
-- hand-added `pg_trgm` GIN indexes are invisible to both sides, so — unlike the
-- `--from-migrations` route — no spurious `DROP INDEX` lines needed trimming here.

-- AlterTable
ALTER TABLE "config" ADD COLUMN     "reg_awb" TEXT;

-- AlterTable
ALTER TABLE "parcels" ADD COLUMN     "b_paid_delivery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pcode" TEXT;

-- CreateIndex
CREATE INDEX "parcels_pcode_idx" ON "parcels"("pcode");

-- CreateIndex
CREATE INDEX "parcels_tracking_received_by_idx" ON "parcels"("tracking_received_by");
