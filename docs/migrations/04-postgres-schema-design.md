# 04 — Postgres Schema Design (parcels domain redesign)

This is the core value-add of the migration, not a lift-and-shift. It directly addresses the problems documented in [02-parcels-domain-analysis.md](02-parcels-domain-analysis.md).

## 1. Status model — replace the virtual CASE waterfall with a maintained column

- Add `parcels.status` as a **real Postgres column**, typed as a `parcel_status` enum: `new, awaiting, received, shipped, delay, custom, processing_custom, office, out_delivery, region, delivered, on_hold, not_on_hold`. (Normalize casing — the current data/logic mixes `Custom`/`OnHold`/`onhold`/`notOnHold` inconsistently; pick one convention, e.g. `snake_case`, and apply it uniformly.)
- Maintain it via **one single PL/pgSQL function** (`fn_recompute_parcel_status(parcel_id)`), which is the **only** place the priority-order business logic lives. Invoked by:
  - A `BEFORE UPDATE` trigger on `parcels`, whenever any of the milestone timestamp columns or hold flags change — status is then always consistent with underlying facts and cannot drift.
  - Application code (Next.js API routes, admin UI, mobile API) **never re-implements the waterfall** — it only ever reads `parcels.status`. This directly eliminates the 8-10 independently-drifted copies documented in §7 of [02-parcels-domain-analysis.md](02-parcels-domain-analysis.md).
- Preserve the exact current priority order confirmed in the list query / `changeParcelStatus.cfm` (`notOnHold > OnHold > delivered > outdelivery > region > office > processingCustom > Custom > Delay > Shipped > Received > Awaiting > New`) as the default source of truth — **but explicitly resolve the discovered discrepancy with `read()`'s different order (delivered checked before hold flags) as a business decision before implementation**, not silently. Document the chosen answer here once resolved (see open question in [07-risks-and-open-questions.md](07-risks-and-open-questions.md)), since it will affect how historical parcels are classified differently depending on which order is chosen.
- This replaces `len(datetimeCol) > 1` non-sargable checks with plain `IS NOT NULL` checks in Postgres, and status is recomputed only on write, never per-query.
- Additionally maintain a `parcel_status_history` table (append-only: `parcel_id, status, changed_at, changed_by, reason`), written by the same trigger/function. This gives a real audit trail — something the legacy system lacks outside the write-only `operations` table — and lets the admin UI show a timeline instead of only current state.
- The 11 `Tracking*` timestamp columns are kept as-is (they are the real event facts, already event-sourced in spirit); `status` becomes a derived/materialized projection of those facts, not something recomputed by string-length hacks in every consumer.

## 2. Eliminate the six per-row correlated subqueries

- **Paid / Invoiced / InvoiceId / invoiceamount**: denormalize onto `parcels` as maintained columns (`is_paid boolean`, `is_invoiced boolean`, `invoice_id uuid`, `invoice_amount numeric(12,2)`), updated by a trigger on `invoices`/`invoices_items` writes — not recomputed via `EXISTS`/`TOP 1` per parcel per list request. This turns an O(n) per-row subquery into an O(1) column read at list time; the cost is paid once at write time instead of on every admin page view.
- **paidamount (user-level aggregate, currently recomputed identically for every parcel row of that user)**: this is the clearest win. Maintain a `user_balances` table (`user_id, paid_amount, invoice_amount, balance, updated_at`), updated by a trigger on `payments`/`invoices` insert/update, joined **once** per list query instead of being a correlated subquery evaluated per parcel row.
- **officename**: denormalize `office_name` onto `parcels`, updated via trigger when the `parceloffice`/`delivery_offices` assignment changes — office assignment changes rarely relative to how often the list is viewed.
- **Net effect**: the bema parcels list query becomes a single flat `SELECT ... FROM parcels JOIN users JOIN receivers ... WHERE ... ORDER BY ... LIMIT ...` with **zero correlated subqueries** — all "computed" fields are already resident as plain columns.

## 3. Pagination

Replace the `@results` table-variable + "skip N via `parcelid NOT IN (SELECT TOP prevrec...)`" pattern (whose cost grows linearly with page number) with:

- **Keyset/cursor pagination** for the primary admin list and the customer "my parcels" list: `WHERE (tripdate, parcel_id) < (:last_tripdate, :last_id) ORDER BY tripdate DESC, parcel_id DESC LIMIT :n`. O(1) per page regardless of depth; works well since the default sort keys (TripDate/TrackingNum/Created) are already confirmed sortable/stable via the current `orderBy` argument handling.
- Standard `OFFSET/LIMIT` only as a fallback for small, bounded result sets (e.g. already-filtered searches expected to return few rows) — not for the main unbounded admin grid.
- The redundant `COUNT(*)` + main-query double execution can be collapsed via `count(*) OVER()` in the same query (single round trip) where an exact total is genuinely needed for pagination UI, or eliminated entirely by switching the admin UI to "load more"/infinite-scroll (keyset-friendly, no total-count requirement) — flag this as a UX decision point for the client, since it removes the need for the COUNT query altogether.

## 4. Indexing strategy (currently zero indexes exist anywhere)

- `parcels(tripdate, id)` — supports keyset pagination on the default sort.
- `parcels(status)` — supports the heavy status-filter usage in the admin UI; consider partial indexes for specific hot filters (e.g. `WHERE status = 'on_hold'`).
- `parcels(user_id)` — supports "my parcels" and admin per-customer lookups.
- `parcels(tracking_num)` (unique or unique-ish) — this is the single most latency-sensitive public query (unauthenticated tracking lookup, currently `ParcelDAO.getParcelByTrackingNum()`) and **must** be indexed.
- `parcels(receiver_id)`, `parcels(created)`.
- GIN/trigram (`pg_trgm`) indexes for the keyword `LIKE '%...%'` searches currently used against `addressbook` (Organization/FirstName/LastName/Phone1/City/State) and `parcels.awb`/`TrackingNum`/`TrackingNum2` — the current leading-wildcard `LIKE` patterns can't use a plain B-tree index at all today; this is a real performance win that doesn't exist in the legacy system.
- A composite index supporting the combined sender+receiver keyword search (the current `isSearch` branch), if that pattern persists in the new admin UI.

## 5. Materialized view — evaluate, don't assume

Given the denormalization in §2 already flattens the query, a materialized view is likely **unnecessary** for correctness. If the admin list needs a "kitchen sink" read model joining many tables (users, addressbook ×2, receivers, office), start with a **plain view** over the now-denormalized columns — a Postgres view over indexed, denormalized columns should already be fast. Only introduce a materialized view (with trigger-driven incremental refresh) if measured admin-list p95 latency requires it after the above changes are in place. Avoid premature complexity.

## 6. Table sketch (for reference, not a final DDL)

Core tables carried over (converted, not redesigned beyond the above): `users`, `addressbook`, `receivers`, `invoices`, `invoices_items`, `payments`, `parceloffice`, `delivery_offices`, `config` (typed settings table).

New/changed for the parcels domain:
- `parcels` — existing columns retained; add `status parcel_status`, `is_paid boolean`, `is_invoiced boolean`, `invoice_id uuid`, `invoice_amount numeric(12,2)`, `office_name text`.
- `parcel_status_history` — new, append-only audit trail.
- `user_balances` — new, one row per user, trigger-maintained.

Exact DDL, trigger function bodies, and enum value finalization are Phase 1 implementation work, not part of this planning document.
