# 0016 — Parcels list performance: measured at 1M rows, not assumed

The client's stated reason for this whole migration is that the legacy parcels screen is slow
at real data volume. The redesigned schema was built to fix that
([0010](0010-prisma-migrations.md), [04-postgres-schema-design.md](../migrations/04-postgres-schema-design.md)),
but until now nothing had been *measured* — the screen was only ever exercised against a
four-row fixture. This records what a benchmark at production scale actually found, which was
not what the design predicted.

## The benchmark

A throwaway local Postgres 16 seeded with:

| Table | Rows |
|---|---|
| `parcels` | 1,000,004 |
| `invoices` / `invoices_items` / `payments` | 650,001 each |
| `addressbook` | 40,003 |
| `users` / `receivers` | 20,003 each |
| `parceloffice` | 199,892 |
| `parcel_status_history` | 1,000,006 (trigger-written) |

Parcels spread over five years with a realistic milestone distribution (65% delivered, a tail
still in flight), tracking numbers/AWBs/codes/groups/services all varied. Timings are the
best of three runs, `EXPLAIN (ANALYZE)` execution time for SQL and `curl` wall time for the
API (which includes Next's dev-mode overhead, so the API figures are pessimistic).

## What was already fine

The parts the schema redesign targeted held up exactly as intended:

- **Status is a column, not a computation.** The legacy `CASE WHEN len(TrackingX) > 1 …`
  waterfall ran per row, per query; here `parcels.status` is trigger-maintained and the
  status filters are plain predicates. `status=delivered` page query: **6ms**.
- **No per-row correlated subqueries.** Legacy recomputed `(select count(*) from
  invoices_items where ParcelId = …)`, `(select SUM(amount) from payments where UserId = …)`
  and `(select top 1 officename …)` for *every row of every page*. Those are now
  `is_invoiced`, `user_balances` and `office_name`, maintained by trigger. The "Paid" filter,
  which was the worst of them: **1.2ms**.
- **Paging is index-ordered.** `parcels_created_idx` plus the `id` tiebreaker: page 1 in
  **0.9ms**, page 800 (offset 20,000) in **44ms**.

## What the benchmark found broken

Three things that only appear at volume. All three are now fixed; the numbers are before → after.

### 1. Keyword search: 1.1–2.9s → 3ms

The search box matches `%term%` across the parcel's own columns **and** its receiver's
address. The initial migration added `pg_trgm` GIN indexes on both tables expecting that to
solve it — but an `OR` spanning two tables cannot use an index on either. The planner walked
`parcels` in `created DESC` order joining out per row: 226k rows examined to return 25.

Fixed with `parcels.search_text`: every searchable field, from both tables, lower-cased into
one trigger-maintained column with a single GIN trigram index. Same denormalisation pattern
the schema already uses for `status`/`is_paid`/`office_name`. Triggers keep it current on
parcel writes and on receiver-address edits, and both skip the work when nothing searchable
changed — so a bulk status stamp over hundreds of parcels pays nothing.

### 2. Milestone date filters: 1971ms → 1ms

"Received Date = one day" had no index to use, so it scanned. Ten partial indexes
(`WHERE col IS NOT NULL`, one per milestone) cover both ways the UI filters these columns —
"is set" (the status waterfall) and "set within a range" (the Extra Search window). Partial,
because the NULLs are never what is being looked for, which also keeps them to the size of
the subset that has reached that stage.

Count for the same filter: 191ms → 0.9ms.

### 3. Row-count follow-up: exact result restored

The page of 25 rows was already milliseconds; `count(*)` over a 650k-row filtered slice was
the entire remaining cost, paid on every page load. The initial optimization capped the count
at 10,000 and displayed `"10,000+"`, but this removed operationally important information:
staff use the exact match count for selection and reconciliation (legacy displayed values such
as `"Select all 68 items"`). The API therefore computes the exact count again and returns
`totalIsExact: true`. This knowingly restores the measured 200–525ms count cost on broad
million-row filters; if that becomes unacceptable, preserve the exact result and move the
count to an asynchronous/cached path rather than replacing it with a cap.

### Bonus: the sender filter, 5.5s → 0.13s

Not a schema problem — a Prisma one. Written as six parcel-level conditions OR-ed together,
Prisma emits one correlated subquery per branch. Moving the `OR` *inside* the `user` relation
filter makes it emit a single `user_id IN (SELECT … FROM users LEFT JOIN addressbook …)` over
the 20k-row `users` table. Identical results, one subquery.

## Where it landed

Full filter set, through the real API at 1M parcels:

| Filter | Before | After |
|---|---|---|
| No filter (default scope) | 0.46s | **0.019s** |
| Keyword search | 6.50s | **0.026s** |
| Keyword search, two terms | — | **0.026s** |
| Tracking # search | — | **0.019s** |
| Sender search | 5.48s | **0.13s** |
| Received Date = one day | 1.97s (SQL) | **0.016s** |
| `status=delivered` | 0.44s | **0.025s** |
| `status=awaiting` (8-predicate waterfall) | 0.18s | **0.22s** |
| Paid = No | 0.52s | **0.040s** |
| City = Tbilisi | 0.31s | **0.21s** |
| Extra search, delivered in one day | — | **0.014s** |
| Extra search, delivered in one month | 0.53s | **0.47s** |
| Page 200 | 0.47s | **0.043s** |
| perPage = 500 | 0.50s | **0.049s** |

## What is still slow, and why it was left

**A milestone range spanning a wide window (a whole month) with the default `created DESC`
sort: ~0.47s.** This is a known Postgres planner trap, not a missing index: with a `LIMIT` and
a filter correlated to the sort column, the planner picks an incremental sort over
`parcels_created_idx` expecting to hit 25 matches early, and instead skips 226k rows. Proven
by diagnosis — the same query with `enable_incremental_sort = off` runs in **59ms** using the
milestone index that *is* there.

Left as-is deliberately. The lever exists (`SET enable_incremental_sort = off` around that
one query) but applying it globally would pessimise other plans, and applying it per-query
means dropping out of Prisma into raw SQL for one report-shaped case. A month of deliveries
in half a second is not the pain point this migration is about — the day/shift-sized windows
the Extra Search form is designed for run in 14ms. Revisit if a real operator complains.

**Broad exact counts** can take 0.2–0.5s (`status=awaiting`, `city=Tbilisi`, and similar
high-cardinality filters). This is the deliberate accuracy tradeoff described above.

## Cost of the fix

`parcels` grew from 493MB to 1403MB at 1M rows — 601MB of that is indexes, including the GIN
trigram index on `search_text`. Write path: the search triggers add one indexed lookup per
parcel write *only when a searchable field changed*, so bulk status operations are unaffected.
Migration runtime on 1M existing rows: ~100 seconds (backfill + index builds).

## Caveat on these numbers

Synthetic data. The distributions are realistic in shape but the real table will have
different cardinalities, and the planner is sensitive to that. What the benchmark establishes
is the *shape* of the problem and that the fixes address it — not a guarantee of specific
milliseconds in production. Re-run against a restored production dump before cutover.

## Re-running this benchmark

`scripts/benchmark-parcels.ts` reproduces the whole thing against any database you point
`DATABASE_URL` at — seed, then drive the real `/api/bema/parcels`, `/reports`, and
`/reports-2` endpoints over HTTP and report timings, so a future schema or query change can
be checked the same way instead of by hand again. The seed includes payment-history events,
current payment fields, and received-by assignments required by Reports 2, and refuses to
finish if it produced no eligible report rows:

```
DATABASE_URL=postgresql://.../bench_db bun scripts/benchmark-parcels.ts --seed --scale=1000000 --confirm=bench_db
DATABASE_URL=postgresql://.../bench_db bun run dev &
DATABASE_URL=postgresql://.../bench_db bun scripts/benchmark-parcels.ts --bench --json=results.json
DATABASE_URL=postgresql://.../bench_db bun scripts/benchmark-parcels.ts --reset --confirm=bench_db
```

`--confirm=<database name>` is required for `--seed`/`--reset` — a deliberate extra step
(separate from `guard-local-db.mjs`, which only guards the `db:migrate`/`db:studio` scripts
and requires `localhost`) so a stray `.env` can't seed or truncate the wrong database; a
benchmark run is not always against `localhost`. `--scale` defaults to 200,000 (seconds, not
minutes, to seed) — pass `--scale=1000000` to reproduce the exact figures in this document.
`--reset` additionally requires `BEMA_SEED_USERNAME`: it snapshots that bootstrap admin and
its linked addresses, balance, and notification preferences before truncation, restores them
inside the same transaction, and aborts unless the variable identifies exactly one user. It
never leaves the local test administrator deleted. The benchmark finds its own sample search
terms/tracking numbers/usernames from the target database rather than hard-coding one run's
values.
