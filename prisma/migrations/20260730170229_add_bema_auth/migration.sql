-- CreateEnum
CREATE TYPE "account_type" AS ENUM ('customer', 'bema_user');

-- CreateEnum
CREATE TYPE "admin_role" AS ENUM ('bema_standard', 'bema_administrator', 'bema_agent');

-- NOTE: `prisma migrate diff` originally proposed DROP INDEX statements for the 9
-- pg_trgm/GIN indexes hand-added in the initial migration (prisma/migrations/*_init/
-- migration.sql). This is expected and documented in docs/decisions/0010-prisma-
-- migrations.md: unlike trigger functions (which Prisma's schema model has no concept of
-- at all and never touches), indexes ARE something Prisma introspects/manages, so any
-- index not declared in schema.prisma shows up as "drift" on every future diff. Removed
-- those 9 DROP INDEX statements by hand here — this is reviewing/trimming a generated
-- migration before applying it (exactly what `--create-only`/manual diffing is for), not
-- hand-authoring DDL from scratch. See that doc for the corrected policy.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "account_type" "account_type" NOT NULL DEFAULT 'customer',
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "admin_role" "admin_role",
ADD COLUMN     "agent_price" BOOLEAN,
ADD COLUMN     "confirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "language" TEXT DEFAULT 'en',
ADD COLUMN     "last_login_at" TIMESTAMPTZ(6),
ADD COLUMN     "lockout_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lockout_expires_at" TIMESTAMPTZ(6),
ADD COLUMN     "password_reset_expires_at" TIMESTAMPTZ(6),
ADD COLUMN     "password_reset_token" TEXT,
ADD COLUMN     "suffix" TEXT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "security_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "security_log_username_created_at_idx" ON "security_log"("username", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_account_type_idx" ON "users"("account_type");

