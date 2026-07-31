-- Generated with `prisma migrate diff --from-schema … --to-schema … --script` (offline), then
-- trimmed to this table only — the same diff also re-proposes the previous migration's
-- `search_text` column, since each diff is taken against the last committed schema file.

-- AlterTable
ALTER TABLE "receivers" ADD COLUMN     "is_ge_citizen" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: until this column existed, the parcel form inferred Georgian citizenship from
-- whether a Georgian-script name was on file. Seed the column from that same inference so no
-- existing receiver silently flips, then let operators correct it from the form.
UPDATE receivers r
   SET is_ge_citizen = true
  FROM addressbook a
 WHERE a.id = r.address_id
   AND (coalesce(a.first_name_ge, '') <> '' OR coalesce(a.last_name_ge, '') <> '');
