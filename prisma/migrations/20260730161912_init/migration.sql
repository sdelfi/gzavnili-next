-- CreateEnum
CREATE TYPE "parcel_status" AS ENUM ('new', 'awaiting', 'received', 'shipped', 'delay', 'custom', 'processing_custom', 'office', 'out_delivery', 'region', 'delivered', 'on_hold', 'not_on_hold');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "username" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "organization" TEXT,
    "billing_address_id" UUID,
    "balance_adjust" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "password_hash" TEXT,
    "password_algo" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addressbook" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "first_name" TEXT,
    "last_name" TEXT,
    "first_name_ge" TEXT,
    "last_name_ge" TEXT,
    "organization" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "postal_code" TEXT,
    "street1" TEXT,
    "street2" TEXT,
    "phone1" TEXT,
    "phone2" TEXT,
    "phone3" TEXT,

    CONSTRAINT "addressbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receivers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "address_id" UUID NOT NULL,

    CONSTRAINT "receivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_offices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "office_name" TEXT NOT NULL,
    "office_name_ge" TEXT,
    "city" TEXT,
    "letter" TEXT,
    "search_patterns" TEXT,

    CONSTRAINT "delivery_offices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parceloffice" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "parcel_id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parceloffice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "invoice_date" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoice_id" UUID NOT NULL,
    "parcel_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "invoices_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "payment_date" TIMESTAMPTZ(6) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_method_id" TEXT NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "crate" TEXT,
    "dt_express_ship" TIMESTAMPTZ(6),
    "dt_express_est" TIMESTAMPTZ(6),
    "dt_regular_ship" TIMESTAMPTZ(6),
    "dt_regular_est" TIMESTAMPTZ(6),
    "exp_awb" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_balances" (
    "user_id" UUID NOT NULL,
    "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "invoice_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_balances_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "parcel_status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "parcel_id" UUID NOT NULL,
    "status" "parcel_status" NOT NULL,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by" TEXT,
    "reason" TEXT,

    CONSTRAINT "parcel_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "receiver_id" UUID,
    "tracking_num" TEXT,
    "tracking_num2" TEXT,
    "trip_date" TIMESTAMPTZ(6),
    "created" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "debt" DECIMAL(12,2),
    "value" DECIMAL(12,2),
    "weight" DECIMAL(12,2),
    "contents" TEXT,
    "store" TEXT,
    "service" TEXT,
    "group_id" TEXT,
    "location" TEXT,
    "i_location" TEXT,
    "notes" TEXT,
    "b_on_hold" BOOLEAN NOT NULL DEFAULT false,
    "b_not_on_hold" BOOLEAN NOT NULL DEFAULT false,
    "tracking_away" TIMESTAMPTZ(6),
    "tracking_received" TIMESTAMPTZ(6),
    "tracking_shipped" TIMESTAMPTZ(6),
    "tracking_delay" TIMESTAMPTZ(6),
    "tracking_custom" TIMESTAMPTZ(6),
    "tracking_processing_custom" TIMESTAMPTZ(6),
    "tracking_office" TIMESTAMPTZ(6),
    "tracking_send_region" TIMESTAMPTZ(6),
    "tracking_out_delivery" TIMESTAMPTZ(6),
    "tracking_delivered_signed" TIMESTAMPTZ(6),
    "tracking_est_delivery" TIMESTAMPTZ(6),
    "tracking_est_ship" TIMESTAMPTZ(6),
    "tracking_received_by" TEXT,
    "tracking_delivered_signed_by" TEXT,
    "top_flag" BOOLEAN NOT NULL DEFAULT false,
    "awb" TEXT,
    "is_dr" BOOLEAN NOT NULL DEFAULT false,
    "pay_method1" TEXT,
    "pay_method2" TEXT,
    "pay_amount1" DECIMAL(12,2),
    "pay_amount2" DECIMAL(12,2),
    "parcel_type" TEXT,
    "b_notify" BOOLEAN NOT NULL DEFAULT false,
    "b_not_declared" BOOLEAN NOT NULL DEFAULT false,
    "length" DECIMAL(10,2),
    "width" DECIMAL(10,2),
    "high" DECIMAL(10,2),
    "dim_weight" DECIMAL(10,2),
    "additional_username" TEXT,
    "additional_firstname" TEXT,
    "additional_lastname" TEXT,
    "buser" TEXT,
    "online_source" TEXT,
    "balance_adjust" DECIMAL(12,2),
    "status" "parcel_status" NOT NULL DEFAULT 'new',
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "is_invoiced" BOOLEAN NOT NULL DEFAULT false,
    "invoice_id" UUID,
    "invoice_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "office_name" TEXT,

    CONSTRAINT "parcels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "receivers_user_id_idx" ON "receivers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "parceloffice_parcel_id_key" ON "parceloffice"("parcel_id");

-- CreateIndex
CREATE INDEX "parceloffice_office_id_idx" ON "parceloffice"("office_id");

-- CreateIndex
CREATE INDEX "invoices_user_id_invoice_date_idx" ON "invoices"("user_id", "invoice_date");

-- CreateIndex
CREATE INDEX "invoices_items_parcel_id_idx" ON "invoices_items"("parcel_id");

-- CreateIndex
CREATE INDEX "invoices_items_invoice_id_idx" ON "invoices_items"("invoice_id");

-- CreateIndex
CREATE INDEX "payments_user_id_payment_date_idx" ON "payments"("user_id", "payment_date");

-- CreateIndex
CREATE INDEX "parcel_status_history_parcel_id_changed_at_idx" ON "parcel_status_history"("parcel_id", "changed_at");

-- CreateIndex
CREATE INDEX "parcels_trip_date_id_idx" ON "parcels"("trip_date", "id");

-- CreateIndex
CREATE INDEX "parcels_status_idx" ON "parcels"("status");

-- CreateIndex
CREATE INDEX "parcels_user_id_idx" ON "parcels"("user_id");

-- CreateIndex
CREATE INDEX "parcels_receiver_id_idx" ON "parcels"("receiver_id");

-- CreateIndex
CREATE INDEX "parcels_created_idx" ON "parcels"("created");

-- CreateIndex
CREATE INDEX "parcels_tracking_num_idx" ON "parcels"("tracking_num");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_billing_address_id_fkey" FOREIGN KEY ("billing_address_id") REFERENCES "addressbook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivers" ADD CONSTRAINT "receivers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivers" ADD CONSTRAINT "receivers_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addressbook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parceloffice" ADD CONSTRAINT "parceloffice_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parceloffice" ADD CONSTRAINT "parceloffice_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "delivery_offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices_items" ADD CONSTRAINT "invoices_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices_items" ADD CONSTRAINT "invoices_items_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_balances" ADD CONSTRAINT "user_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcel_status_history" ADD CONSTRAINT "parcel_status_history_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "receivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================================================
-- Everything below this line is hand-written (not generated by `prisma migrate dev`),
-- implementing the Phase 1 redesign from docs/migrations/04-postgres-schema-design.md.
-- Prisma's schema.prisma has no way to express triggers/functions/operator classes, so
-- this is the one place that logic lives. It is intentionally NOT re-derived from
-- schema.prisma on future `prisma migrate dev` runs — Prisma only diffs
-- tables/columns/indexes/enums that appear in schema.prisma; this block is replayed as-is
-- from migration history (including on a from-scratch `prisma migrate reset` of a dev/
-- shadow database), so it never gets silently dropped by a future generated migration.
-- =====================================================================================

-- `config` is a single-row settings table (docs/migrations/01-current-state-audit.md /
-- docs/migrations/07-risks-and-open-questions.md) — this CHECK plus the existing PK on
-- `id` together make a second row impossible (id != 1 fails the check; id = 1 twice fails
-- the PK).
ALTER TABLE "config" ADD CONSTRAINT "config_single_row" CHECK ("id" = 1);

-- Trigram search support (docs/migrations/04-postgres-schema-design.md §4) — the current
-- leading-wildcard `LIKE '%...%'` searches against these columns can't use a plain B-tree
-- index at all today; this is a real performance win the legacy schema never had.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "addressbook_organization_trgm_idx" ON "addressbook" USING gin ("organization" gin_trgm_ops);
CREATE INDEX "addressbook_first_name_trgm_idx" ON "addressbook" USING gin ("first_name" gin_trgm_ops);
CREATE INDEX "addressbook_last_name_trgm_idx" ON "addressbook" USING gin ("last_name" gin_trgm_ops);
CREATE INDEX "addressbook_phone1_trgm_idx" ON "addressbook" USING gin ("phone1" gin_trgm_ops);
CREATE INDEX "addressbook_city_trgm_idx" ON "addressbook" USING gin ("city" gin_trgm_ops);
CREATE INDEX "addressbook_state_trgm_idx" ON "addressbook" USING gin ("state" gin_trgm_ops);

CREATE INDEX "parcels_awb_trgm_idx" ON "parcels" USING gin ("awb" gin_trgm_ops);
CREATE INDEX "parcels_tracking_num_trgm_idx" ON "parcels" USING gin ("tracking_num" gin_trgm_ops);
CREATE INDEX "parcels_tracking_num2_trgm_idx" ON "parcels" USING gin ("tracking_num2" gin_trgm_ops);

-- -------------------------------------------------------------------------------------
-- Status model (docs/migrations/04-postgres-schema-design.md §1): replaces the legacy
-- non-sargable `CASE WHEN len(TrackingX) > 1 ...` waterfall
-- (docs/migrations/02-parcels-domain-analysis.md §2.1), duplicated and drifted across
-- 8-10 call sites (§7), with one maintained column and one function.
--
-- Priority order below matches the bema admin list query (hold flags win first). This is
-- the PROVISIONAL default per docs/migrations/04-postgres-schema-design.md §1 — the
-- single-parcel `read()` endpoint checks `delivered` before the hold flags instead, and
-- docs/migrations/07-risks-and-open-questions.md open question #1 flags this as requiring
-- explicit client sign-off before Phase 1's exit criteria are met. If that decision comes
-- back the other way, this function is the only place that needs to change.
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_recompute_parcel_status() RETURNS trigger AS $$
BEGIN
  NEW.status :=
    CASE
      WHEN NEW.b_not_on_hold THEN 'not_on_hold'::parcel_status
      WHEN NEW.b_on_hold THEN 'on_hold'::parcel_status
      WHEN NEW.tracking_delivered_signed IS NOT NULL THEN 'delivered'::parcel_status
      WHEN NEW.tracking_out_delivery IS NOT NULL THEN 'out_delivery'::parcel_status
      WHEN NEW.tracking_send_region IS NOT NULL THEN 'region'::parcel_status
      WHEN NEW.tracking_office IS NOT NULL THEN 'office'::parcel_status
      WHEN NEW.tracking_processing_custom IS NOT NULL THEN 'processing_custom'::parcel_status
      WHEN NEW.tracking_custom IS NOT NULL THEN 'custom'::parcel_status
      WHEN NEW.tracking_delay IS NOT NULL THEN 'delay'::parcel_status
      WHEN NEW.tracking_shipped IS NOT NULL THEN 'shipped'::parcel_status
      WHEN NEW.tracking_received IS NOT NULL THEN 'received'::parcel_status
      WHEN NEW.tracking_away IS NOT NULL THEN 'awaiting'::parcel_status
      ELSE 'new'::parcel_status
    END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_parcels_recompute_status"
BEFORE INSERT OR UPDATE ON "parcels"
FOR EACH ROW
EXECUTE FUNCTION fn_recompute_parcel_status();

-- Append-only audit trail (docs/migrations/04-postgres-schema-design.md §1) — something
-- the legacy system lacks outside the write-only `operations` table. Runs AFTER the
-- BEFORE-trigger above has already settled NEW.status. `changed_by`/`reason` are optional:
-- application code that wants attribution should `SET LOCAL app.changed_by = '...'` (and
-- optionally `app.status_change_reason`) in the same transaction before the write;
-- otherwise both are recorded as NULL.
CREATE OR REPLACE FUNCTION fn_log_parcel_status_history() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO "parcel_status_history" ("parcel_id", "status", "changed_at", "changed_by", "reason")
    VALUES (
      NEW.id,
      NEW.status,
      now(),
      current_setting('app.changed_by', true),
      current_setting('app.status_change_reason', true)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_parcels_log_status_history"
AFTER INSERT OR UPDATE ON "parcels"
FOR EACH ROW
EXECUTE FUNCTION fn_log_parcel_status_history();

-- -------------------------------------------------------------------------------------
-- Denormalized office name (docs/migrations/04-postgres-schema-design.md §2) — replaces
-- the legacy `SELECT TOP 1 officename FROM parceloffice JOIN delivery_offices ...`
-- per-row correlated subquery. Office assignment changes rarely relative to how often the
-- list is viewed, so this is maintained on write to `parceloffice` (assignment/reassignment)
-- and on `delivery_offices` (a rename should propagate to every parcel currently assigned
-- to that office).
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_sync_parcel_office_name() RETURNS trigger AS $$
DECLARE
  target_parcel_id uuid := COALESCE(NEW.parcel_id, OLD.parcel_id);
BEGIN
  UPDATE "parcels" p
  SET "office_name" = (
    SELECT do_."office_name" FROM "parceloffice" po
    JOIN "delivery_offices" do_ ON do_."id" = po."office_id"
    WHERE po."parcel_id" = target_parcel_id
  )
  WHERE p."id" = target_parcel_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_parceloffice_sync_office_name"
AFTER INSERT OR UPDATE OR DELETE ON "parceloffice"
FOR EACH ROW
EXECUTE FUNCTION fn_sync_parcel_office_name();

CREATE OR REPLACE FUNCTION fn_sync_office_name_on_rename() RETURNS trigger AS $$
BEGIN
  IF NEW."office_name" IS DISTINCT FROM OLD."office_name" THEN
    UPDATE "parcels" p
    SET "office_name" = NEW."office_name"
    WHERE p."id" IN (SELECT "parcel_id" FROM "parceloffice" WHERE "office_id" = NEW."id");
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_delivery_offices_sync_name"
AFTER UPDATE OF "office_name" ON "delivery_offices"
FOR EACH ROW
EXECUTE FUNCTION fn_sync_office_name_on_rename();

-- -------------------------------------------------------------------------------------
-- Denormalized paid/invoiced state (docs/migrations/04-postgres-schema-design.md §2) —
-- replaces the legacy Paid/Invoiced/InvoiceId/invoiceamount correlated subqueries
-- (docs/migrations/02-parcels-domain-analysis.md §2.2). Note `is_paid`/`is_invoiced` are
-- intentionally driven by the same `invoices_items` existence check, matching the legacy
-- behavior where both were literally the same EXISTS query duplicated rather than reused
-- (§2.2) — not something this pass redefines, since the actual business distinction (if
-- any) was never documented.
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_sync_parcel_invoice_denorm() RETURNS trigger AS $$
DECLARE
  target_parcel_id uuid := COALESCE(NEW.parcel_id, OLD.parcel_id);
BEGIN
  UPDATE "parcels" p
  SET
    "is_paid" = EXISTS (SELECT 1 FROM "invoices_items" ii WHERE ii."parcel_id" = p."id"),
    "is_invoiced" = EXISTS (SELECT 1 FROM "invoices_items" ii WHERE ii."parcel_id" = p."id"),
    "invoice_id" = (SELECT ii."invoice_id" FROM "invoices_items" ii WHERE ii."parcel_id" = p."id" ORDER BY ii."id" LIMIT 1),
    "invoice_amount" = COALESCE((
      SELECT SUM(ii."amount") FROM "invoices_items" ii
      JOIN "invoices" i ON i."id" = ii."invoice_id"
      WHERE ii."parcel_id" = p."id" AND i."user_id" = p."user_id" AND i."invoice_date" > '2011-04-01'
    ), 0)
  WHERE p."id" = target_parcel_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_invoices_items_sync_parcel"
AFTER INSERT OR UPDATE OR DELETE ON "invoices_items"
FOR EACH ROW
EXECUTE FUNCTION fn_sync_parcel_invoice_denorm();

-- `invoice_amount`'s cutoff filter is on `invoices.invoice_date`, not on invoices_items
-- itself, so an invoice's date changing must also re-sync every parcel billed on it.
CREATE OR REPLACE FUNCTION fn_sync_parcels_on_invoice_date_change() RETURNS trigger AS $$
BEGIN
  IF NEW."invoice_date" IS DISTINCT FROM OLD."invoice_date" THEN
    UPDATE "parcels" p
    SET "invoice_amount" = COALESCE((
      SELECT SUM(ii."amount") FROM "invoices_items" ii
      JOIN "invoices" i ON i."id" = ii."invoice_id"
      WHERE ii."parcel_id" = p."id" AND i."user_id" = p."user_id" AND i."invoice_date" > '2011-04-01'
    ), 0)
    WHERE p."id" IN (SELECT "parcel_id" FROM "invoices_items" WHERE "invoice_id" = NEW."id");
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_invoices_sync_parcels_on_date_change"
AFTER UPDATE OF "invoice_date" ON "invoices"
FOR EACH ROW
EXECUTE FUNCTION fn_sync_parcels_on_invoice_date_change();

-- -------------------------------------------------------------------------------------
-- Denormalized user-level balance (docs/migrations/04-postgres-schema-design.md §2) — the
-- clearest win in the legacy analysis: `paidamount` was a user-level SUM recomputed
-- identically for every parcel row belonging to that user
-- (docs/migrations/02-parcels-domain-analysis.md §2.2, "the single worst offender").
-- `balance = paid_amount - invoice_amount` is this pass's interpretation, not something
-- explicitly specified in docs/migrations/04-postgres-schema-design.md — confirm against
-- actual legacy statement/balance-page behavior before relying on it for anything
-- customer-facing.
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_sync_user_balance(target_user_id uuid) RETURNS void AS $$
BEGIN
  INSERT INTO "user_balances" ("user_id", "paid_amount", "invoice_amount", "balance", "updated_at")
  VALUES (
    target_user_id,
    COALESCE((
      SELECT SUM("amount") FROM "payments"
      WHERE "user_id" = target_user_id AND "payment_date" > '2011-04-01' AND "payment_method_id" != 'balance'
    ), 0),
    COALESCE((
      SELECT SUM(ii."amount") FROM "invoices_items" ii
      JOIN "invoices" i ON i."id" = ii."invoice_id"
      WHERE i."user_id" = target_user_id AND i."invoice_date" > '2011-04-01'
    ), 0),
    0,
    now()
  )
  ON CONFLICT ("user_id") DO UPDATE SET
    "paid_amount" = EXCLUDED."paid_amount",
    "invoice_amount" = EXCLUDED."invoice_amount",
    "updated_at" = now();

  UPDATE "user_balances" SET "balance" = "paid_amount" - "invoice_amount" WHERE "user_id" = target_user_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_trg_sync_user_balance_from_payments() RETURNS trigger AS $$
BEGIN
  PERFORM fn_sync_user_balance(COALESCE(NEW."user_id", OLD."user_id"));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_payments_sync_user_balance"
AFTER INSERT OR UPDATE OR DELETE ON "payments"
FOR EACH ROW
EXECUTE FUNCTION fn_trg_sync_user_balance_from_payments();

CREATE OR REPLACE FUNCTION fn_trg_sync_user_balance_from_invoices() RETURNS trigger AS $$
BEGIN
  PERFORM fn_sync_user_balance(COALESCE(NEW."user_id", OLD."user_id"));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_invoices_sync_user_balance"
AFTER INSERT OR UPDATE OR DELETE ON "invoices"
FOR EACH ROW
EXECUTE FUNCTION fn_trg_sync_user_balance_from_invoices();

CREATE OR REPLACE FUNCTION fn_trg_sync_user_balance_from_invoice_items() RETURNS trigger AS $$
DECLARE
  target_invoice_id uuid := COALESCE(NEW."invoice_id", OLD."invoice_id");
  target_user_id uuid;
BEGIN
  SELECT "user_id" INTO target_user_id FROM "invoices" WHERE "id" = target_invoice_id;
  IF target_user_id IS NOT NULL THEN
    PERFORM fn_sync_user_balance(target_user_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_invoices_items_sync_user_balance"
AFTER INSERT OR UPDATE OR DELETE ON "invoices_items"
FOR EACH ROW
EXECUTE FUNCTION fn_trg_sync_user_balance_from_invoice_items();
