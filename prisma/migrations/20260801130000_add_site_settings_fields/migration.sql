-- AlterTable
ALTER TABLE "config" ADD COLUMN     "airway_bill" TEXT,
ADD COLUMN     "airway_date" TIMESTAMPTZ(6),
ADD COLUMN     "consignee" TEXT,
ADD COLUMN     "declared_price" TEXT,
ADD COLUMN     "dt_cargo_est" TIMESTAMPTZ(6),
ADD COLUMN     "dt_cargo_ship" TIMESTAMPTZ(6),
ADD COLUMN     "non_declared_price" TEXT,
ADD COLUMN     "site_message" TEXT;
