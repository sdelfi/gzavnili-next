# 0015 — bema Parcels: what was ported, and what was deliberately not

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
| `?rid=…&status=notonhold` clears both hold flags **from a GET link**, executed inline at the top of the list page | `POST /api/bema/parcels/:id/clear-hold` |
| An agent's "only my parcels" scope is enforced by overwriting a URL param inside the view | Enforced server-side in the route handler, from the session role |
| A bulk "office" operation silently drops parcels held by customs from the id list and reports nothing | Same rule, but the skipped ids and the reason come back in the response and are shown |
| CSV export strips the delimiter out of values and wraps some columns in `="…"` to fight Excel's autoformatting | RFC 4180 quoting plus a UTF-8 BOM — values arrive intact, Georgian names included |
| Paging via `row_number() over (order by <one column>)` with no tiebreaker — rows can be skipped or repeated across pages when timestamps collide | `id` as the final sort key |

## Deliberate divergences (not bugs either way)

- **The implicit "parcels you received" scope.** Legacy silently sets `eadmin` to the current
  admin when *no* filter is set — invisible on the *main* list itself, the results just look
  short. **Reverted to that exact silent behaviour on 2026-07-31** — the scoping itself is
  still ported (an unfiltered page load, and every agent load, is still pinned to the
  operator's own received parcels), but an earlier pass had added a banner explaining it plus
  an `allReceivers=1` opt-out that legacy never had. Per explicit client instruction against
  unrequested additions ("legacy fidelity: bugs are ported, not fixed" cuts against
  *unbugging* it with UX legacy doesn't have, too), both are gone: no banner, no opt-out. The
  only way to see everyone's parcels is what legacy always required — set some other filter.
  One thing *is* still reported to the client, because it isn't a UI addition: legacy's
  `eadmin` also feeds the "Received By" select on the *extra* search form, so that dropdown
  shows the operator's own name whenever the implicit scope is active — not "Any", which would
  misrepresent what's actually applied. `effectiveReceivedBy` on the list response exists only
  to seed that select correctly; it is not shown anywhere else and there is no opt-out attached
  to it.
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

## The edit screen (`parcels-update.cfm` + `vwParcelsUpdate.cfm`)

Ported as its own pass, after the list. Same field set, same five groupings legacy uses
(parcel / receiver / customer / measurements+payment / tracking dates), same validation rules
(`validation/bema/ParcelUpdate.cfc` plus the two checks the controller does inline), and the
same five-part save: parcel, receiver (created if "< New Receiver >"), the sender's own name
and billing address, the delivery-office assignment, and a `paid`/`unpaid` operation.

### Fixed rather than reproduced

| Legacy behaviour | What this port does |
|---|---|
| The save writes parcel, receiver, customer, office and payment one after another with **no transaction** — a failure halfway leaves a parcel pointing at a half-written receiver, or a customer renamed for a parcel that didn't save | The first four are one transaction; the paid/unpaid operation stays outside it deliberately, since it raises invoices and payments with their own transaction semantics |
| `goWeight()` recalculates the price on **every keystroke** in weight or dimensions and overwrites whatever the operator typed into Amount, so a hand-set price cannot survive a later edit to the weight | The suggestion is computed and shown with its reasoning ("Regular — $8.00/kg, on dimensional weight 98.36 kg"); pressing **Use** applies it. Dimensional weight is still filled in automatically — it is derived from three numbers with no judgement in it |
| `alert('Don\'t forget to check the AWB field')` fires on every Service/Trip Date change | An inline warning next to the AWB field. A modal that interrupts typing to say "remember something later" is the worst possible shape for that reminder |
| Picking a receiver from the dropdown fetches that one receiver's address in a **second** request, per selection | The customer's receivers come back with their addresses in one request, so selecting fills the fields instantly |
| Parcel Content is a dropdown plus a free-text box, switched by the literal stored value `"Other"` | One text field, with the dropdown as a shortcut into it — no sentinel value to round-trip |
| Zod's `flatten()` (and legacy's flat message list) can't say *which* nested field failed | `flattenIssues()` keys every issue by its dotted path (`receiver.city`), so the failing field is the one that gets marked |

### Deliberate divergences

- **`isgecitizen` is derived, not stored.** Legacy keeps a flag on the receiver row; this
  schema has no such column, so the checkbox is initialised from whether a Georgian-script
  name is on file — which is the only thing the flag actually controls (which name pair is
  required). Ticking it makes the GE pair required for that save.
- **"Need delivery" (`officeid = 999`)** is a hard-coded pseudo-office legacy writes as if it
  were a real office id. `parceloffice.office_id` is a real foreign key here, so it can't
  round-trip. It is data, not code: if still wanted, it belongs in `delivery_offices` as a
  row, after which it appears in the dropdown like any other.
- **The `MR` agent rate (8.5/kg for Regular)** in `PricingHelper.js` is not carried over —
  nothing in the legacy codebase sets the `userPref` it keys off, so it can never fire.
  Related to `agentPrefix` being dead in the list query, above.

## Scope

Built: the **list** — both search forms, all filters, sender/trip grouping, bulk operations,
group pay, per-row delete and hold-clear, CSV export, "Export Airway", the Delivery Request
(`delreq`) slice, and the agent role restrictions. And the **edit screen**, per the section
above.

Not built (each is its own legacy screen, linked from the row's action column, and rendered
inert with a "Not implemented yet" title rather than dropped): **add parcel** (legacy serves
it from the same file as edit via `nrc=1`, with its own defaults, button row and "Save & Add
Another" flow), parcel view, parcel print, the statements module's invoice and history popups,
and the messages module's Send/Resend SMS. The edit form's "Invoice File" upload/preview row
belongs to the files module and is not built either.

**"Export Airway"** (`export=2` → `airway.cfm`) is a document for the airline rather than a
view of this screen. No legacy `airway.cfm` source exists anywhere in this repo to port from —
only its column header line was recoverable (confirmed against the running legacy site):
`HAWB,No. of Pieces,Account ID,Carrier Tracking Number (s),Shipper Name,Shipper Address,
Consignee Name,Consignee Address,ActualWeight,Value of HAWB,Description of Contents`, under a
title line `Air Cargo Manifest`. Legacy's export never populates any rows regardless of the
screen's filters — clicking it always downloads just those two lines. That is a dead/broken
manifest export in legacy, not a missing feature, so it is ported faithfully as the same
static two-line file (`src/app/api/bema/parcels/export-airway/route.ts`) rather than being
"fixed" into a real per-parcel manifest export. See `docs/findings.md`.
