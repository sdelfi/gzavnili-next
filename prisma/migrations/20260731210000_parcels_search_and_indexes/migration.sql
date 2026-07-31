-- Generated with `prisma migrate diff --from-schema <previous schema.prisma> --to-schema
-- prisma/schema.prisma --script` (offline; this environment has no shadow database), then
-- extended with the hand-written block below — trigger functions and partial/GIN indexes,
-- neither of which Prisma's schema language can express. See
-- docs/decisions/0010-prisma-migrations.md for that policy, and
-- docs/decisions/0016-parcels-performance.md for the benchmark that produced this migration.

-- AlterTable
ALTER TABLE "parcels" ADD COLUMN     "search_text" TEXT;

-- ============================================================================================
-- Hand-written from here down: search denormalisation + the indexes the parcels list needs.
--
-- IMPORTANT: like the `pg_trgm` indexes in the initial migration, the indexes below are
-- invisible to `schema.prisma` (Prisma cannot express partial indexes or operator classes),
-- so a future `prisma migrate diff` WILL propose `DROP INDEX` for every one of them. Read the
-- generated SQL and remove those lines — see docs/decisions/0010-prisma-migrations.md.
-- ============================================================================================

-- --- 1. Keyword search --------------------------------------------------------------------
--
-- `parcels.search_text` is every field the list's keyword box looks at, lower-cased into one
-- column. The search is a leading-wildcard match (`%term%`) OR-ed across `parcels` *and* the
-- receiver's `addressbook` row; no index can serve that across a join, so the planner walked
-- the whole table (measured: 1.1-2.9s at 1M parcels). One column plus one GIN trigram index
-- makes it a single-table indexed lookup (measured: 3ms).

CREATE OR REPLACE FUNCTION fn_parcel_search_text(
  p_tracking_num text, p_tracking_num2 text, p_awb text,
  p_additional_firstname text, p_additional_lastname text, p_additional_username text,
  p_buser text, p_receiver_id uuid
) RETURNS text AS $$
DECLARE
  v_address addressbook%ROWTYPE;
BEGIN
  IF p_receiver_id IS NOT NULL THEN
    SELECT a.* INTO v_address
    FROM receivers r JOIN addressbook a ON a.id = r.address_id
    WHERE r.id = p_receiver_id;
  END IF;

  RETURN lower(concat_ws(' ',
    p_tracking_num, p_tracking_num2, p_awb,
    p_additional_firstname, p_additional_lastname, p_additional_username, p_buser,
    v_address.first_name, v_address.last_name, v_address.first_name_ge, v_address.last_name_ge,
    v_address.organization, v_address.city, v_address.state, v_address.cell_phone
  ));
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION fn_parcels_sync_search_text() RETURNS trigger AS $$
BEGIN
  -- Skip the receiver lookup entirely when nothing searchable changed. Without this every
  -- bulk status stamp (`updateMany` over hundreds of parcels) would pay for one extra join
  -- per row to recompute a value that cannot have changed.
  IF TG_OP = 'UPDATE'
     AND NEW.receiver_id IS NOT DISTINCT FROM OLD.receiver_id
     AND NEW.tracking_num IS NOT DISTINCT FROM OLD.tracking_num
     AND NEW.tracking_num2 IS NOT DISTINCT FROM OLD.tracking_num2
     AND NEW.awb IS NOT DISTINCT FROM OLD.awb
     AND NEW.additional_firstname IS NOT DISTINCT FROM OLD.additional_firstname
     AND NEW.additional_lastname IS NOT DISTINCT FROM OLD.additional_lastname
     AND NEW.additional_username IS NOT DISTINCT FROM OLD.additional_username
     AND NEW.buser IS NOT DISTINCT FROM OLD.buser
  THEN
    RETURN NEW;
  END IF;

  NEW.search_text := fn_parcel_search_text(
    NEW.tracking_num, NEW.tracking_num2, NEW.awb,
    NEW.additional_firstname, NEW.additional_lastname, NEW.additional_username,
    NEW.buser, NEW.receiver_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_parcels_sync_search_text
  BEFORE INSERT OR UPDATE ON parcels
  FOR EACH ROW EXECUTE FUNCTION fn_parcels_sync_search_text();

-- Editing a receiver's address has to refresh every parcel that quotes it. Bounded by that
-- receiver's own parcels, and only when a searchable field actually changed.
CREATE OR REPLACE FUNCTION fn_addressbook_sync_parcel_search_text() RETURNS trigger AS $$
BEGIN
  IF (NEW.first_name, NEW.last_name, NEW.first_name_ge, NEW.last_name_ge,
      NEW.organization, NEW.city, NEW.state, NEW.cell_phone)
     IS DISTINCT FROM
     (OLD.first_name, OLD.last_name, OLD.first_name_ge, OLD.last_name_ge,
      OLD.organization, OLD.city, OLD.state, OLD.cell_phone)
  THEN
    UPDATE parcels p
       SET search_text = fn_parcel_search_text(
             p.tracking_num, p.tracking_num2, p.awb,
             p.additional_firstname, p.additional_lastname, p.additional_username,
             p.buser, p.receiver_id)
      FROM receivers r
     WHERE r.id = p.receiver_id AND r.address_id = NEW.id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_addressbook_sync_parcel_search_text
  AFTER UPDATE ON addressbook
  FOR EACH ROW EXECUTE FUNCTION fn_addressbook_sync_parcel_search_text();

-- Backfill existing rows (no-op on an empty database).
UPDATE parcels p SET search_text = fn_parcel_search_text(
  p.tracking_num, p.tracking_num2, p.awb,
  p.additional_firstname, p.additional_lastname, p.additional_username, p.buser, p.receiver_id);

CREATE INDEX parcels_search_text_trgm_idx ON parcels USING gin (search_text gin_trgm_ops);

-- --- 2. Milestone timestamps ---------------------------------------------------------------
--
-- Every one of these columns is filterable two ways from the list: "is set" (the Status
-- waterfall) and "set within a range" (the Extra Search From/To window). Partial, because the
-- NULLs are never the thing being looked for — which also keeps the indexes to the size of
-- the subset that has actually reached that stage.
--
-- Measured at 1M parcels, Received Date = one day: 1971ms -> 0.97ms (page), 191ms -> 0.88ms
-- (count).

CREATE INDEX parcels_tracking_received_idx ON parcels (tracking_received) WHERE tracking_received IS NOT NULL;
CREATE INDEX parcels_tracking_away_idx ON parcels (tracking_away) WHERE tracking_away IS NOT NULL;
CREATE INDEX parcels_tracking_shipped_idx ON parcels (tracking_shipped) WHERE tracking_shipped IS NOT NULL;
CREATE INDEX parcels_tracking_delay_idx ON parcels (tracking_delay) WHERE tracking_delay IS NOT NULL;
CREATE INDEX parcels_tracking_custom_idx ON parcels (tracking_custom) WHERE tracking_custom IS NOT NULL;
CREATE INDEX parcels_tracking_processing_custom_idx ON parcels (tracking_processing_custom) WHERE tracking_processing_custom IS NOT NULL;
CREATE INDEX parcels_tracking_office_idx ON parcels (tracking_office) WHERE tracking_office IS NOT NULL;
CREATE INDEX parcels_tracking_send_region_idx ON parcels (tracking_send_region) WHERE tracking_send_region IS NOT NULL;
CREATE INDEX parcels_tracking_out_delivery_idx ON parcels (tracking_out_delivery) WHERE tracking_out_delivery IS NOT NULL;
CREATE INDEX parcels_tracking_delivered_signed_idx ON parcels (tracking_delivered_signed) WHERE tracking_delivered_signed IS NOT NULL;

-- --- 3. Paid / invoiced --------------------------------------------------------------------
--
-- The "Paid" filter reads the trigger-maintained `is_invoiced`/`debt` instead of legacy's
-- per-row `(select count(*) from invoices_items where ParcelId = ...)`. Partial index for the
-- unpaid-with-a-balance case, which is the one operators pull constantly and the one that is
-- a small minority of the table.
CREATE INDEX parcels_unpaid_idx ON parcels (created DESC) WHERE is_invoiced = false AND debt > 0;
