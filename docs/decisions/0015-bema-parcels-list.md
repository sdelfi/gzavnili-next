# 0015 — bema Parcels list: what was ported, and what was deliberately not

The parcels screen is the heart of the bema panel — the one every operator lives in. This
records the source it was ported from, the legacy behaviours found to be dead or broken along
the way, and the handful of places this port deliberately diverges.

## Which legacy file is actually the screen

`bema/parcels/` holds four near-identical copies of the same list (`parcels.cfm`,
`parcels2.cfm`, `parcels_work.cfm`, plus five views: `vwParcels.cfm`, `vwParcels_work.cfm`,
`vwParcels_work2.cfm`, …). Only one pair is live:

- **Controller: `bema/parcels/parcels.cfm`** — the URL the nav links to.
- **View: `views/parcels/vwParcels_work2.cfm`** — chosen at the bottom of the controller by
  `<cfif cgi.remote_addr neq '0.71.190.227.95'>`, a comparison against a malformed
  (five-octet) IP literal that can never match any real client address. So the `<cfelse>`
  branch (`vwParcels_work.cfm`) is unreachable and `vwParcels.cfm` is orphaned entirely.

Treat the other copies as abandoned drafts, the same way `views/home*.html` was found to be
dead earlier in this migration (see `PROGRESS.md`).

## Dead legacy behaviour, not ported

- **The "Recent Parcels" block.** The controller runs `getParcels()` a *second* time (same
  filters, different ordering, last 30 days) to feed a block whose render is gated on
  `<cfif grps.recordCount and 0>` — a condition that is constant false. Every request paid
  for a second full scan of `parcels` to build markup nobody has seen. This port issues one
  query.
- **`agentPrefix`.** Declared as a `getParcels()` argument, computed by
  `bema/include/agent-prefix-map.cfm` (a hard-coded map of three user ids to `CH`/`MR`), and
  passed in by the controller — but never referenced by a single line of the query body.
  Dead; porting it would port a no-op.
- **`operations` / `ParcelHistory` audit inserts.** Replaced by the `parcel_status_history`
  trigger from the initial migration, which records changes regardless of which code path
  made them. Legacy only recorded changes that happened to go through `doOperation()`.
- **The 1000-id chunking loop** in `doOperation()`, which existed to keep a generated
  `WHERE (1=2) OR ParcelId=… OR …` under SQL Server's expression limit. A parameterised `IN`
  list has no such limit.
- **`GZ20001` special-case in the CSV export**, which rewrites that one account's USERNAME
  column to `"Linoli " & additional_username`. A per-customer hack in a generic export; if
  it is still wanted it belongs in data, not in the exporter.

## Legacy bugs fixed rather than reproduced

| Legacy behaviour | What this port does |
|---|---|
| Status filter options `Removed from OnHold`, `Processing Custom` and `Paid` have no branch in `getParcels()`'s status chain — selecting them silently returns an **unfiltered** list | All three filter for real (`status = not_on_hold` / the `tracking_processing_custom` waterfall / `is_paid`) |
| The `office` status filter's exclusion list differs between the count query and the page query (only the page query also excludes `region`), so the row count disagreed with the rows | One `buildParcelWhere()` shared by the count, the page and the export |
| "Extra search"'s To-hour dropdown marks its selected option against `url.eh1`, so it never showed the hour actually applied | One state object per form; the control always shows what is applied |
| "Extra search" repeats the main form's "Show:" per-page dropdown, and whichever form you submitted last wins | One per-page control, on the main form |
| `?rid=…&status=notonhold` clears both hold flags **from a GET link**, executed inline at the top of the list page | `PATCH /api/bema/parcels/:id` with `{ clearHold: true }` |
| An agent's "only my parcels" scope is enforced by overwriting a URL param inside the view | Enforced server-side in the route handler, from the session role |
| A bulk "office" operation silently drops parcels held by customs from the id list and reports nothing | Same rule, but the skipped ids and the reason come back in the response and are shown |
| CSV export strips the delimiter out of values and wraps some columns in `="…"` to fight Excel's autoformatting | RFC 4180 quoting plus a UTF-8 BOM — values arrive intact, Georgian names included |
| Paging via `row_number() over (order by <one column>)` with no tiebreaker — rows can be skipped or repeated across pages when timestamps collide | `id` as the final sort key |

## Deliberate divergences (not bugs either way)

- **The implicit "parcels you received" scope.** Legacy silently sets `eadmin` to the current
  admin when *no* filter is set, which is genuinely useful (an operator's first screen is
  their own work) but invisible — the list just looks short. Kept, with two changes: the
  screen says so in a banner, and `allReceivers=1` opts out. Agents cannot opt out.
- **Payment-method reconstruction.** For an invoiced parcel with no `payMethod1`, legacy ran
  two extra queries per row and, failing those, *guessed* the method from the length of the
  transaction id (32/16 → "Credit Card", 17 → "PayPal", 12 → "Authorize.net"). This schema
  records the method on the parcel when the payment is taken, so there is nothing to
  reconstruct; legacy rows imported without one show `—` rather than a guess.
- **Date handling.** Date-only filters resolve against UTC day boundaries and timestamps
  render in UTC with the US `mm/dd/yyyy h:mm AM` format legacy used. Legacy compared naive
  MSSQL `datetime`s with no zone at all, so there is no legacy behaviour to match — UTC is
  the deterministic choice, and it means Tbilisi and New York read the same number off the
  same delivery timestamp.
- **Georgian milestone labels.** Six labels in the tracking column had a `session.language`
  switch. The bema panel has no language switch (see 0011), so they are English; the label
  list in `ParcelTrackingCell` is the single place a future messages file would hook into.

## Schema additions

`prisma/migrations/20260731200000_add_parcel_pcode_paid_delivery/`:

- `parcels.pcode` — the short pickup code shared by a sender/trip group, printed on the group
  header and set by the "Change code" bulk operation.
- `parcels.b_paid_delivery` — legacy `bPaidDelivery`, "the delivery fee has been collected".
  Distinct from the trigger-derived `is_paid`; the Delivery Request queue filters on it.
- `config.reg_awb` — the regular-service trip AWB. Only `exp_awb` had been carried over, but
  the "Set AWB" operation needs both to know which trip's estimated dates to stamp.

Generated with `prisma migrate diff --from-schema … --to-schema … --script` (no database
required), rather than the `--from-migrations` form in 0010 — this environment has no
Postgres to act as the shadow database. Diffing two schema files also means the hand-added
`pg_trgm` GIN indexes are invisible to both sides, so no spurious `DROP INDEX` lines needed
trimming.

## Scope

Built: the list itself — both search forms, all filters, sender/trip grouping, bulk
operations, group pay, per-row delete and hold-clear, CSV export, the Delivery Request
(`delreq`) slice, and the agent role restrictions.

Not built (each is its own legacy screen, linked from the row's action column, and rendered
inert with a "Not implemented yet" title rather than dropped): parcel edit
(`vwParcelsUpdate.cfm`, ~1,400 lines), parcel view, parcel print, the statements module's
invoice and history popups, and the messages module's Send/Resend SMS. "Export Airway"
(`export=2` → `airway.cfm`) is a document for the airline rather than a view of this screen,
and is also still to do.
