# 0018 — Restoring the legacy `ParcelHistory` edit log

**Status:** accepted, implemented
**Supersedes:** the `ParcelHistory` half of
[0015-bema-parcels-list.md](0015-bema-parcels-list.md)'s "not carried over" list, and corrects
[../migrations/04-postgres-schema-design.md](../migrations/04-postgres-schema-design.md) §1's
premise.

## The question that prompted this

While porting the bema "Parcels Reports" screen the client asked, directly: *on what basis was
the decision made not to port the edit-history table? If the screen works differently without
it, add the table.* This document is the answer and the correction.

## What the earlier decision actually said, and why it was wrong

Three documents, written in this order:

1. **[../migrations/02-parcels-domain-analysis.md](../migrations/02-parcels-domain-analysis.md)
   §4** inventories the parcels domain's tables. It lists `operations` — the tiny
   `(ParcelID, Operation, OperationTime)` log — and **does not mention `ParcelHistory` at
   all.** The audit phase simply missed it.
2. **[../migrations/04-postgres-schema-design.md](../migrations/04-postgres-schema-design.md)
   §1** then designed `parcel_status_history` and justified it as giving "a real audit trail —
   something the legacy system lacks outside the write-only `operations` table". **That premise
   is factually false.** Legacy has `ParcelHistory`, and it is richer than the table introduced
   to replace it: per-field old/new values, the payment method and amount taken at that moment,
   and the id of the admin who made the change.
3. **[0015-bema-parcels-list.md](0015-bema-parcels-list.md)** inherited the error and wrote
   "`operations` / `ParcelHistory` audit inserts. Replaced by the `parcel_status_history`
   trigger" — lumping the two together as if they were the same kind of thing.

So: there was never an analysis weighing `ParcelHistory` and rejecting it. There was a table
that was never audited, a claim built on its absence, and a later decision that inherited the
claim. **The basis for the decision was a mistake, not a trade-off.**

The consequence was concrete. The first pass at Parcels Reports had to reconstruct the money
tables from `invoices`/`payments` and the parcel's *current* `pay_method1`/`pay_amount1`
columns, could not populate "Colected In USA"/"Colected In Georgia" or the "Received by"
column at all (nothing recorded which admin acted), and could only show two of the History
tab's seven columns. That is a screen that works differently from legacy — which, per the
project's standing legacy-fidelity rule, is not an acceptable outcome for a screen operators
reconcile cash against.

## Decision

**Port `ParcelHistory` as the `parcel_history` table** (migration
`20260801062224_add_parcel_edit_history`), keep `parcel_status_history` alongside it, and
rebuild the reports on top of it.

The two tables are not redundant; they answer different questions and are written by different
mechanisms:

| | `parcel_status_history` | `parcel_history` (this one) |
|---|---|---|
| Written by | a DB trigger on `parcels` | application code, explicitly |
| Records | status transitions only | field diffs, payments, operations |
| Knows *who* | no | yes (`updater_id` FK) |
| Knows payment detail | no | yes (`pay_method`/`pay_amount` as taken) |
| Can a caller forget it? | no | yes — hence the trigger table stays |

Keeping both means the trigger table remains the thing you can trust for "what statuses did
this parcel pass through", while the edit log carries the business detail a trigger physically
cannot know (which operator was logged in, which payment instrument was used).

## Fidelity: columns and written values

Column names and semantics mirror legacy 1:1, so an ETL import is a straight copy and the
report queries port literally. Every legacy write site was transcribed and is reproduced —
the table of `editStatus`/`valueName`/`old`/`new`/`pay*` tuples lives in
`src/lib/services/parcelHistory.ts`'s file header, next to the code that emits them.

Two details that look like nits and are not:

- **Empty strings, not NULLs**, for every column legacy fills with `''`. The report's
  `ph.payMethod != 'Debt'` predicate is three-valued in SQL: a NULL there would silently
  *exclude* a row legacy includes. Verified that Prisma's `{ not: 'Debt' }` compiles to a bare
  `<> $1` against Postgres, so MSSQL's behaviour is matched without a special case.
- **`updater_name` survives** as a denormalized string even though `updater_id` is a real FK,
  because it is not always derivable: `money-collect.cfm`'s backfill writes
  `Updater = 'Online'` with a NULL `updaterid` for payments that had no operator at all.

## Two deliberate storage improvements (no observable change)

- `updater_id` is a **real FK to `users`**; legacy stored a bare, unindexed GUID string. The
  reports' per-admin grouping becomes a normal indexed join.
- **Three composite indexes**, where legacy has none anywhere in the database
  (02-parcels-domain-analysis.md §5 — "no `CREATE INDEX` … found anywhere in the repository",
  which is a large part of why the legacy reports are slow):

  | Index | Serves |
  |---|---|
  | `(value_name, edit_date_time)` | Total Sale / Payment Colected / Remain Payment / Paid transactions — equality then range, one index scan |
  | `(parcel_id, edit_date_time)` | one parcel's timeline; the reports' per-parcel dedupe |
  | `(updater_id, edit_date_time)` | "Colected In USA"/"Colected In Georgia" |

  Measured on a 200k-row table: the Q1 shape plans as
  `Index Scan using parcel_history_value_name_edit_date_time_idx`, 4 shared buffer hits,
  ~0.06 ms — versus the sequential scan the same query is forced into without it.

  Index choice is deliberately conservative (three, not one per predicate): this is a
  write-heavy table — a row per field change — so each index is paid for on every parcel edit.

## What the reports now do that they could not before

- **"Colected In USA" / "Colected In Georgia"** render, grouped per admin.
- **"Received by"** shows the processing admin's name.
- **History tab** shows all seven legacy columns (Old/New/ValueName/PayMethod/PayAmount).
- **The BEMA-agent exclusion** (`updaterrGroup.groupid IS NULL` — legacy's group 15) is
  applied, as legacy does, to every figure on the screen.
- **Money figures come from the payment event**, not from the parcel's current, overwritable
  `pay_method1`/`pay_amount1` — so editing a parcel after payment no longer retroactively
  changes a historical report.

## Legacy bugs reproduced, not fixed

Recorded in full in [../findings.md](../findings.md); summarised here because they are the
main reason to read that file:

- **"Colected In Georgia" credits the table but not the total.** The
  `updaterCountry eq "GE"` branch adds to `CollectedGE[k]` while incrementing
  `totalAmountGE`'s *sibling*, `totalAmountUS`. The Georgia rows therefore do not sum to the
  Georgia total, and the USA total is inflated. Reproduced verbatim and covered by an
  end-to-end check, because these figures reconcile real cash: a silent correction here would
  be a financial discrepancy against the old system, not a cleanup.
- **`Remain Payment` excludes parcels whose `payMethod2` is NULL**, because legacy's three
  `!=` comparisons are NULL-propagating. Reproduced.
- The unsorted `<cfloop group=…>` under/over-counting found in the first pass is **no longer
  applicable** — it was an artifact of reconstructing these figures from a differently-shaped
  source. Reading the same rows legacy reads removes the ambiguity entirely.

## What is still not ported

`money-collect.cfm`'s one-off backfill `INSERT … SELECT` (which fabricates history rows for
pre-2018-04 payments that predate the log) — it belongs to the Money Collect screen, which is
not built yet, and is a data-repair job rather than application behaviour.
