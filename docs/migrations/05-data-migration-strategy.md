# 05 — Data Migration Strategy (MSSQL → Postgres)

## Principle: this is a structural migration, not a data copy

The client has emphasized that today's table structure and queries are not optimal — most visibly the parcel status calculation and the filters on the `bema/parcels` page (see [02-parcels-domain-analysis.md](02-parcels-domain-analysis.md)). The migration must carry that structural change through, not just relocate the existing MSSQL schema onto Postgres as-is.

Concretely: today `status` does not exist as a column — it's recomputed on every read via a non-sargable `CASE` over 11 timestamp columns, duplicated (and drifted) across 8-10 call sites. In the new schema (see [04-postgres-schema-design.md](04-postgres-schema-design.md) §1), `status` is a **real, stored `parcel_status` enum column**, written once at the moment an underlying fact changes (a milestone timestamp or hold flag is set) via a single trigger-invoked function (`fn_recompute_parcel_status`) — never recomputed at read time, and never reimplemented anywhere else. The same principle applies to the other per-row correlated subqueries (`Paid`/`Invoiced`/`invoiceamount`/`paidamount`/`officename`, see [04-postgres-schema-design.md](04-postgres-schema-design.md) §2): they become plain maintained columns, not query-time computations.

Everything below in this document — the ETL, the batching, the reconciliation — exists specifically to populate and validate *that new structure* for all historical data, not to mirror the old one.

## 1. Tooling

Use **pgloader** as the base for mechanical schema/data conversion (it handles MSSQL→Postgres type mapping, FK constraints, and can run incrementally) for tables that carry over largely as-is (`users`, `addressbook`, `receivers`, `invoices`, `invoices_items`, `payments`, `parceloffice`, `delivery_offices`, `config`).

**Do not** auto-migrate the `parcels` table 1:1. The parcels domain gets the redesigned schema from [04-postgres-schema-design.md](04-postgres-schema-design.md), which requires a **custom ETL/transform script**, not a mechanical column copy, that computes the initial `status`, `is_paid`, `is_invoiced`, `invoice_amount`, `office_name`, and `user_balances` values for all historical rows before cutover — backfilling exactly what the new triggers will maintain going forward.

## 2. Batched extraction (data volume)

The client has confirmed the dataset is large, so the migration script must **not** attempt a single unbounded extract. Requirements for the custom ETL:

- Extract from MSSQL in **batches** (e.g. keyset-paginated by `ParcelId`/`Created` ranges, not `OFFSET`-based — the same non-sargable pagination trap documented in [02-parcels-domain-analysis.md](02-parcels-domain-analysis.md) applies to a naive migration script just as much as it does to the admin UI).
- Each batch should be independently retryable/idempotent (upsert on primary key in Postgres) so a failed batch can be re-run without re-processing the whole dataset or double-inserting.
- Batch size should be tuned empirically against both source (MSSQL read load — this is a live production database, so extraction must not degrade production query performance) and target (Postgres write/trigger overhead — remember every insert into the new `parcels` table fires the status/denormalization triggers from [04-postgres-schema-design.md](04-postgres-schema-design.md), so bulk-load performance should be measured, and consider temporarily disabling triggers during bulk backfill and running the recomputation function in a single set-based pass afterward instead of row-by-row via trigger).
- Log progress (last successfully migrated batch key) so the job is resumable after interruption.
- Run the full batched backfill against a **copy** of production data first, not production itself, to validate correctness and timing before scheduling the real cutover run.

## 3. Data type mapping concerns specific to this schema

- MSSQL `datetime`/`smalldatetime` → Postgres `timestamptz`. **Confirm timezone assumptions** before converting — the `len(datetimeCol) > 1` pattern in the legacy code implies these columns may contain empty-string-like or other sentinel values in practice, not clean `NULL`s. Audit actual data (distinct value patterns, not just the schema) before assuming "NULL = milestone not yet reached" holds for 100% of historical rows.
- MSSQL `uniqueidentifier` (e.g. `UserId` values like `581ACE56-EEE2-E30F-50E6B1F3359ECAAE`) → Postgres `uuid`.
- MSSQL `bit` → Postgres `boolean`.
- Money/decimal precision on `Debt`, `Value`, `Weight`, `payAmount1/2`, invoice/payment amounts → exact `numeric(p,s)` mapping in Postgres, never `float`/`double`, to avoid rounding errors on financial fields.

## 4. Cutover model per domain

- One-time bulk backfill (pgloader for simple tables / custom batched ETL for parcels) **plus** a bounded-window, **one-directional** sync (a scheduled job copying new/changed MSSQL rows into Postgres, recomputing derived columns) during the parallel-run period for that domain, then a hard cutover — MSSQL becomes a read-only archive for that table set.
- **Avoid bidirectional CDC.** The parcels schema is intentionally diverging (virtual CASE vs. maintained enum + denormalized columns); a bidirectional sync would need to reverse-engineer the new Postgres status back into the legacy CASE-compatible format, adding real complexity for no benefit, since MSSQL is being retired.
- **Payments/orders**: the one place a short-lived (days, not weeks) dual-write is justified. Once Phase 3 (checkout/payments) cuts over, consider writing to Postgres as primary with a synchronous best-effort mirror write to MSSQL as a safety net during the initial rollout window only, removed once confidence is established — given the cost of a lost payment record vastly exceeds the cost of the extra write.

## 5. Verification / reconciliation

- Row-count and checksum reconciliation scripts, run per table, per migrated batch.
- **Status-distribution reconciliation**: before trusting the new `parcels.status` column for the bema admin list cutover, compare the count of parcels per status value between the legacy CASE output and the new Postgres-derived status across the **full historical dataset** — not just a sample. Any mismatch must be explained (most likely due to the priority-order discrepancy noted in [02-parcels-domain-analysis.md](02-parcels-domain-analysis.md) §2.3, or a sentinel-value assumption from §3 above being wrong) before cutover.
- Spot-check financial aggregates (`user_balances.paid_amount`/`invoice_amount`) against the legacy per-row `SUM()` subqueries for a sample of users, to validate the denormalization triggers compute identical totals.
