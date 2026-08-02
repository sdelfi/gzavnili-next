-- The DROP INDEX statements `prisma migrate diff` proposed here for the hand-added pg_trgm
-- GIN indexes (not declared in schema.prisma, so they show up as drift) were removed per
-- docs/decisions/0010-prisma-migrations.md's documented policy — they aren't part of this
-- schema change.

-- CreateEnum
CREATE TYPE "job_run_status" AS ENUM ('running', 'success', 'failed');

-- CreateTable
CREATE TABLE "operations" (
    "operation_id" SERIAL NOT NULL,
    "parcel_id" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "operation_time" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "operations_pkey" PRIMARY KEY ("operation_id")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_name" TEXT NOT NULL,
    "status" "job_run_status" NOT NULL DEFAULT 'running',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "detail" TEXT,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operations_parcel_id_idx" ON "operations"("parcel_id");

-- CreateIndex
CREATE INDEX "job_runs_job_name_started_at_idx" ON "job_runs"("job_name", "started_at");

-- AddForeignKey
ALTER TABLE "operations" ADD CONSTRAINT "operations_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
