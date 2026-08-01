# Findings log

A running record of legacy quirks/bugs discovered while porting — not decisions about *this*
project's architecture (that's `decisions/`), just "here is what the legacy source actually
does, here's the evidence, here's what happened to it in the port." Per the client's explicit
instruction: **legacy logic is ported 1:1, bugs included** — a "found a bug" is not license to
silently fix it. Every entry below ends in one of three states:

- **Ported as-is** — the quirk is reproduced, because it's reachable/observable behavior.
- **Not reachable, nothing to port** — the "bug" only exists in code no live path can trigger
  (e.g. a fallback for a state the UI never produces); there's no observable behavior to
  replicate, so there's nothing here that porting "1:1" would even mean.
- **Open — needs a decision** — found, understood, and *not yet acted on* either way; flagged
  here instead of silently choosing.

Add an entry whenever a legacy quirk is found, in the same change that ports (or explicitly
skips) it — see AGENTS.md's "Legacy fidelity: bugs are ported, not fixed" rule.

---

## Parcels list "Received By: Any" — 2026-08-01

**Found:** legacy `parcels.cfm`'s auto-scope-to-self logic (`url.eadmin = session.buser.getUserID()`
when no filter is "meaningful", `../http/bema/parcels/parcels.cfm:59-83`) checks `len(url.eh1)
eq 0` / `eh2`/`et1`/`et2`/`estatus` as part of its "was anything filtered" condition — fields
that belong to the separate "Extra Search" `<form>` (the From/To hour+minute range selects).
Those are HTML `<select>`s, which always post a real value (minimum `"0"`), never an empty
string — so submitting that form *always* fails the `len(...) eq 0` check on at least one of
those fields, regardless of what the operator actually picked. That accident is the only
thing that lets "Received By: Any" (`eadmin=""`) actually show all admins' parcels: without
it, an explicit empty `eadmin` is indistinguishable from "never touched" and would reset back
to the current admin, same as a fresh page load. Confirmed against the live site
(`usa.gzavnili.com`): current-user scope shows 68 items, switching to Any shows 549,779.

This project's port (`ParcelListPage`/`ParcelExtraFilters`) shares one merged filter state
between both of legacy's separate forms and serializes it through a single URL builder, so it
doesn't get this accidental signal for free — `receivedBy=''` was indistinguishable from
"not set" and always fell back to self-scoping, so "Any" silently did nothing.

**Ported the observable behavior, not the accident.** Rather than reproduce the HTML-form
quirk itself (which would require splitting the querystring per-form, a larger change with
its own tradeoffs — filters from the two forms currently compose in this SPA, unlike legacy's
per-form GET which discards the other form's fields), "Any" now sends an explicit sentinel
(`RECEIVED_BY_ANY = 'any'`, `src/lib/parcels/constants.ts`) instead of `''`, so the API can
tell "explicitly Any" apart from "not yet set" without relying on select-always-has-a-value.
Net effect for the operator is identical to legacy: default view is scoped to self, explicitly
picking Any shows everyone's parcels.

---

## Receivers screen: hardcoded username block (`receivers.cfm`) — 2026-08-01

**Found:** `../http/bema/parcels/receivers.cfm:1-3` — before the normal group-based access
check even runs, the screen unconditionally `<cfabort>`s if the logged-in bema username is
literally `GZ28489`: `<cfif ListFind('GZ28489', session.buser.getUsername())><cfabort></cfif>`.
No comment explaining why; reads as one specific account someone locked out of this one
screen at some point (e.g. after a data-entry incident), not a role- or permission-based
rule — every other access check in this file (and its sibling `receivers-update.cfm`/
`receivers-delete.cfm`) is a normal `groups="..."` check, this is the only hardcoded-username
gate in the receivers module.

**Not reachable, nothing to port.** This project's auth model (`src/lib/auth/session.ts`,
`AdminRole` enum) has no concept of a per-account username blocklist independent of role —
and no legacy user data has been imported yet (see `docs/migrations/05-data-migration-
strategy.md`), so a `GZ28489` account doesn't exist in this schema to block. Recorded here so
if/when legacy bema accounts are ever imported, this one-off exclusion isn't silently lost —
it's a decision to make explicitly (ask the client whether it's still wanted) rather than to
either quietly carry over or quietly drop.

---

## Parcels list "Export Airway" (`airway.cfm`) — 2026-07-31, corrected 2026-08-01

**Found (first pass, wrong):** with no `airway.cfm` source available and no real export sample
to check against, this was assumed to be a two-line stub (`Air Cargo Manifest` title + column
header, no data). **That assumption was wrong.** A real export pulled from the live legacy site
(`tmp/airway_export.csv`, provided 2026-08-01) shows the document is a populated manifest header
— `Airway Bill:`, `SHIPMENT DATE:`, `SHIPPER NAME:`, `CONSIGNEE:`, `AIRPORT OF DEPARTURE:`/
`AIRPORT OF DESTINATION:`, `NO. OF PIECES:`, `TOTAL ACTUAL WEIGHT:`, `TOTAL Value:` — before the
same empty data-row table. Only the *data rows* are genuinely always empty, matching what was
previously (correctly) understood as "the list is empty" — the header portion above it is not
empty and was simply never seen before this sample existed.

Byte-for-byte quirks confirmed from the sample: no BOM; every line ends in a bare `\n` except
the column-header row, which ends `\r\n`; `AIRPORT OF DEPARTURE:`/`AIRPORT OF DESTINATION:` have
a literal trailing tab character before the newline; `CONSIGNEE:`'s address contains un-decoded
`&nbsp;` HTML entities as literal text. SHIPPER NAME, CONSIGNEE, and both AIRPORT fields are
identical across the whole sample regardless of what's being exported — a single hardcoded
US-warehouse-to-Georgia-office shipment record, not data this schema stores. `SHIPMENT DATE:`,
`NO. OF PIECES:`, `TOTAL ACTUAL WEIGHT:`, and `TOTAL Value:` are blank in the sample too — kept
blank, since there's no evidence of what would populate them.

**Verdict: ported as-is** (`src/app/api/bema/parcels/export-airway/route.ts`), reproducing the
sample byte-for-byte for everything static. **Open — not independently verified:** the "Airway
Bill" value itself. The route reads `config.regAwb`, falling back to `config.expAwb` — those are
the only AWB-shaped fields this schema has, but nothing confirms this export actually corresponds
to the Regular-service AWB specifically (vs. Express, vs. some other selection this schema
doesn't model at all). Flagged rather than silently assumed correct.

---

## Parcels list CSV export ("Export Parcels") formatting — 2026-07-31, corrected 2026-08-01

**Found (first pass, wrong):** the original build of `/api/bema/parcels/export` replaced
legacy's actual CSV formatting with "proper" RFC 4180 quoting and a UTF-8 BOM, on the reasoning
that legacy's own approach (stripping commas out of plain fields, wrapping specific columns in
Excel's `="…"` formula syntax to stop it eating leading zeros) "mangles the data" and quoting
properly "keeps the values intact". That is exactly a case of improving on legacy instead of
porting it — a real 2.7MB export pulled from the live legacy site (`tmp/parcels_export.csv`,
provided 2026-08-01) confirms legacy really does both of those things, consistently across all
9,999 sample rows (every row has exactly 28 comma-separated fields — no field is ever
CSV-quoted even though several contain values that would need it — and exactly 7 `="…"` pairs
per row, always the same 7 columns).

Further quirks confirmed from the sample, not previously known at all:
- **Zero-value formatting differs between the DEBT and PAID columns.** DEBT/DEBT GEL render a
  bare `0.` (trailing decimal point, no digits) when the amount is exactly zero; PAID/PAID GEL
  render a bare `0` (no decimal point). Any non-zero amount on either renders normally with two
  decimals, and WEIGHT/VALUE always render with two decimals regardless of value. Two different
  legacy code paths format the same "zero" two different ways — not unified into one here.
- **Five receiver/customer columns render a single space when empty, not a blank cell**:
  FIRST NAME, LAST NAME, ADDRESS, UBANY, STORE NAME. The seven formula-wrapped columns do the
  same inside their formula (`=" "`, not `=""`). The remaining plain columns (Status, Received
  in USA, Payment method, Location, Office Name, Notes) render genuinely empty when blank,
  confirmed from the same sample rows — this isn't a blanket "empty becomes space" rule.

**Verdict: ported as-is.** `csvCell()`'s RFC 4180 quoting and the BOM are gone; replaced with
`plainCell()` (comma-stripped, no quoting), `formulaCell()` (the seven `="…"` columns, `" "`
default), `blankAsSpace()` (the five space-default columns), and `debtCell()`/`paidCell()` (the
asymmetric zero formatting). See `src/app/api/bema/parcels/export/route.ts`'s file header for
the full column-by-column breakdown.

---

## Batch "Add Parcel" (`parcels-add.cfm`) — 2026-07-31

### The two-payment-method split is dead code

**Found:** `parcels-add.cfm`'s POST handler computes a `payAmount1`/`payAmount2` split of the
two payment-method amounts, proportional to each drafted parcel's share of the batch total,
and passes `payAmount1` into `parcelDao.doOperation('paid', payAmount1 = form.payAmount1)`.
Reading `MSSQLParcelDAO.cfc`'s actual `doOperation('paid')` body (not just the `.cfm` call
site) shows it **ignores the `payAmount1` argument entirely** and computes its own amount from
the parcel row already in the database: `resAmount = parcel.getDebt()`, minus
`parcel.getPayAmount2()` only if that column is already non-zero. `payMethod2`/`payAmount2`
are never included in this screen's own `parcel.init(...)` call before `parcelDao.create()`,
so for every parcel this screen creates, that column is always empty and `resAmount` is
always the parcel's full debt. The split computed a few lines earlier in the `.cfm` is never
read again outside one commented-out `if` block.

**Verdict: ported as-is (which means: the split is *not* reproduced, because legacy's real
behavior is "invoice full debt, ignore the split").** `parcelBatchAdd.ts` invoices each parcel
for its full `debt` when payment method 1 isn't "Debt" — reusing `applyPaidOperation`, the
same function the edit screen already uses, which independently implements this exact
"full debt minus payAmount2-if-set" rule. This is not a "fix" — it's what running legacy
actually does today; an earlier draft of this port had instead implemented the *formula* the
`.cfm` computes and used it for something legacy itself never does (a proportional invoice),
which was the actual deviation. See `docs/decisions/0017-bema-add-parcel.md` for the full
trace.

**Resolved for UI fidelity:** the "Payment method 2" / two "Amount" input fields remain in
`ParcelAddPaymentSection`, matching what legacy's screen actually shows operators (including
`#paymentAmount` being marked `required="true"` even though nothing reads it meaningfully).
The second method itself is optional when the second amount is blank or zero; it is only
required when an operator enters a non-zero second amount. The new schema intended to model
that condition, but its blank-money transform produces `null` and the original refinement
only accepted numeric `0`, accidentally making the method mandatory for an untouched blank
field. The refinement now treats `null` as zero.

### The `$5` minimum charge stacks with the delivery fee, doesn't replace it

**Found:** `sortParcelsTable()`'s per-group total: the Delivery (+$5 flat) / Region (+$5 per
10kg) fee is added first, and *then* the group's charge is compared against $5 using the
group's **pre-fee** total — so a low-value Delivery-type group is charged both the flat fee
and the top-up to $5, not whichever is larger. Reads like it should be an "or"; isn't, in the
source.

**Verdict: ported as-is.** `computeGroupIncrease()` in `batchPricing.ts` stacks both, and
`batchPricing.test.ts` has a dedicated test (`"a low-value group is topped up to the minimum,
on top of any delivery fee"`) locking this in so a future cleanup pass doesn't "simplify" it
away.

### `form.store` falling back to the misspelled `'Presonal'`

**Found:** `parcels-add.cfm` has `if(form.store eq '') { form.store = 'Presonal'; }` (a typo
for `'Personal'`) as a server-side fallback. But `form.store` defaults to `'Personal'`
(correctly spelled) at the top of the same file, and the Store input in
`views/parcels/vwParcelsAdd.cfm`'s add-parcel modal is commented out of the markup entirely —
no control on this screen can ever leave `form.store` blank by the time that fallback would
run.

**Verdict: not reachable, nothing to port.** `parcelBatchAdd.ts` hardcodes `store: 'Personal'`
or every parcel this screen creates, which is the only value `form.store` can ever actually
hold here. There is no code path producing the typo's observable effect to replicate — it
isn't a case of "found a bug, chose not to port it," there's genuinely no reachable behavior
attached to it in this flow.

### BEMA-agent flat-rate override — ported; the tracking-number prefix half stays unported

**Found:** `parcels-add.js`'s `calculateDebtByService()` charges a BEMA agent
(`session.buser.getGroupId() eq 15`, i.e. the *acting operator's own account* — not the
customer the parcels are for) a flat `agentPrice` per kg instead of the standard rate, for
Regular-service parcels only (the Express/Cargo branches of the same function never check
`isAgent`), when `userPref != 'MR'`. `userPref` comes from `agent-prefix-map.cfm`, which maps
three hardcoded legacy MSSQL `BemaUser` GUIDs to `CH`/`MR` prefixes. Cross-checking the "MR"
one against `bema/include/exclude-agents.cfm`'s comment (`"GZ2863114 - Exclude MR
(26259424-...) from financial reports due to role change"`) gave a stable identifier — a
*username*, not a GUID — for the one account this exclusion actually names. `User.agentPrice`
being a real numeric rate (not the bare `Boolean` this schema had simplified it to in an
earlier phase) is confirmed by `bema/users/user_edit.cfm`/`vwUserEditForm.cfm`: a genuine
`<input type="number" step="0.01">` on the BEMA-user edit screen, currently not even wired
into this project's `UserForm` at all.

**Verdict: ported.**
- `prisma/schema.prisma`: `User.agentPrice` changed from `Boolean?` to `Decimal(10,2)?`
  (migration `20260731230000_agent_price_numeric`) — the boolean was itself the gap, not a
  decision to preserve.
- `UserForm`/`userSchema.ts`: a real "Agent Price" number input, alongside "Suffix" (both
  BemaUser-only fields in legacy, same `typeid eq 1` gate).
- `batchPricing.ts`'s `resolveAgentFlatRate()`: `isAgent && agentPrice && username !=
  'GZ2863114'` → the configured rate, else `null`. Applied in `computeDraftParcelTotals()` for
  Regular-service items only, matching `calculateDebtByService()`'s own service check.
  `parcelBatchAdd.ts` resolves this from the *acting session's* user id (not the customer),
  matching legacy's `session.buser`; the client-side live preview
  (`ParcelAddPage`/`ParcelDraftTable`) resolves the same way from `useBemaAuth()`'s `user` for
  display, but the server's own independent resolution is what's authoritative.
- The `CH`/`MR` **tracking-number prefix** itself stays unported — the two `CH` GUIDs have no
  recoverable identifier anywhere in the source (unlike MR's), and the whole prefix is
  cosmetic (doesn't affect price), see docs/decisions/0017.

**Not yet independently verifiable:** whether the specific numeric rate value carried over
correctly for any *real* legacy agent — no legacy data has been imported yet (ETL not
started, per PROGRESS.md), so `GZ2863114` and any BEMA Agent's `agentPrice` are both empty in
this schema today. The mechanism is in place and unit-tested against the formula; it has
nothing to act on until real accounts exist.

---

## Customer Pricing Rules: soft delete, overlap trigger, `Cargo` service type — 2026-08-01

**Found:** the first-pass port of "Pricing Rules (Custom Rates & Discounts)"
(`PricingRulesSection`, `docs/decisions/0011-bema-admin.md`) only covered a fraction of
`customer_pricing_rules`'s real legacy behavior, discovered while fixing an unrelated bug
(a nested `<form>` breaking the "Add Rule" button — see `UserForm.tsx`/`PricingRulesSection.
tsx`):

1. Legacy's "Remove" (`bema/ajax/pricing/deleteRule.cfm` →
   `MSSQLCustomerPricingRuleDAO.deactivatePricingRule`, `../extensions/components/DAO/MSSQL/
   MSSQLCustomerPricingRuleDAO.cfc:431-456`) sets `IsActive=0` + `DeletedDate`/`DeletedBy` —
   never a real row delete — and a matching "Restore"
   (`restoreRule.cfm` → `activatePricingRule`, same file:464-517) flips it back. The port's
   first pass did a real `db.customerPricingRule.delete()`.
2. `PricingService.createPricingRule` (`../extensions/components/service/PricingService.
   cfc:265-340`) rejects a new rule if it overlaps an existing *active* rule for the same
   `userId`+`serviceType` in date range (`validateRuleForConflicts` →
   `getOverlappingRules`), and a DB trigger (`../database/migration_add_overlap_trigger.
   sql`) re-checks the same thing on every `INSERT`/`UPDATE`, so restoring a deactivated rule
   can also fail with "Cannot create overlapping pricing rules for the same customer and
   service type." The port's first pass had no such check anywhere.
3. Legacy `ServiceType` is `Regular`/`Express`/`Cargo` (`vwPricingRulesSection.cfm`,
   `vwGlobalPricingRulesAdmin.cfm`); the Prisma enum and `PricingRulesSection` UI only had
   `Regular`/`Express`.
4. Legacy's per-customer Status column (`vwPricingRulesSection.cfm`'s
   `displayPricingRules`) is keyed purely off `IsActive`/`DeletedDate` ("Active"/"Inactive"),
   independent of whether the rule's date range has actually expired — a rule can show
   "Active" while expired; date-range validity only affects the separate "Show Active Only"
   list toggle. The port's first-pass `isActive()` helper instead conflated the two into
   "Active"/"Expired".
5. There's a second, entirely separate legacy screen —
   "Pricing Rules Administration" (`bema/pricing_global_rules.cfm` /
   `vwGlobalPricingRulesAdmin.cfm`, `groupId 10`-gated) — a paginated, filterable,
   cross-customer view over the same table, with its own AJAX endpoint
   (`getAllRulesGlobal.cfm`). Nothing under this had been built at all.

**Verdict: ported, with one deliberate mechanism substitution.**
- Schema (migration `20260801012211_customer_pricing_rules_soft_delete_cargo`):
  `CustomerPricingRule` gained `isActive`/`deletedAt`/`deletedBy`; `ServiceType` gained
  `Cargo`.
- API: `POST`/`.../restore` both call `findOverlappingActiveRule`
  (`src/lib/services/pricingRuleOverlap.ts`) before writing, replicating
  `getOverlappingRules`'s exact interval-intersection condition. `DELETE` now updates
  (`isActive:false`, `deletedAt`/`deletedBy`) instead of deleting the row; a new
  `[ruleId]/restore/route.ts` reverses it.
- The legacy DB trigger itself is **not** reproduced as a hand-authored Postgres trigger —
  every write to this table goes through this app's API (no direct-DB write path exists
  outside it), so the app-layer check in `findOverlappingActiveRule` achieves the same
  rejected behavior without a second enforcement layer. This is a deliberate mechanism
  substitution, not a skipped behavior — the *reject overlapping active rules on create and
  on restore* behavior is fully ported, just enforced once rather than twice.
- `PricingRulesSection`: `Cargo` added to the form; Status column now keys off `isActive`
  alone; "Show All Rules"/"active only" toggle now combines `isActive && withinDateRange`
  client-side (matching legacy's `displayPricingRules`); Actions column shows
  "Deactivate"/"Restore" instead of "Remove"; value hint switches between "USD per KG" and
  "% Discount (0-100)" by mode, and 0-100 is enforced both client-side and in
  `pricingRuleSchema`.
- New "Pricing Rules Administration" page (`routes.bema.pricingRules()`,
  `PricingRulesAdminPage`, `src/app/api/bema/pricing-rules/route.ts`), gated to
  `BemaAdministrator` only — the closest analog to legacy's `groupId 10` exclusivity in this
  app's flatter `AdminRole` model.

**Not yet independently verifiable:** whether `groupId 10` maps 1:1 to `BemaAdministrator`
(vs. some other legacy group) — inferred from `docs/decisions/0011-bema-admin.md`'s existing
note that `AdminRole` collapsed several legacy admin groups into one enum, not confirmed
against legacy group data directly.

---
## Parcels Reports (`parcels-reports.cfm`) — 2026-08-01, superseded same day

**First pass (wrong premise, now corrected).** This entry originally recorded that the whole
screen had to be rebuilt on substitute data sources because "this schema deliberately has no
equivalent" of legacy's `ParcelHistory` edit log, and listed the per-admin "Colected In USA"/
"Colected In Georgia" tables, the "Received by" column and five of the History tab's seven
columns as *open — needs a decision*, on the grounds that adding the table would be a change
"bigger than this report screen".

**That was the wrong call, and the premise behind it was false.** `ParcelHistory` was never
weighed and rejected — it was missed during the audit phase
(`docs/migrations/02-parcels-domain-analysis.md` §4 inventories the parcels tables and does
not mention it), and `04-postgres-schema-design.md` §1 then asserted legacy "lacks" an audit
trail on the strength of its absence. Legacy has one, and it is richer than the
`parcel_status_history` table introduced to replace it.

**Verdict: the table is ported** (`parcel_history`, migration
`20260801062224_add_parcel_edit_history`) and every figure on the screen now comes from the
same rows legacy reads. Full reasoning, the schema, the index choices and the measured effect
are in `docs/decisions/0018-parcel-edit-history.md`. Nothing about this screen is "open — needs
a decision" any more.

The genuine legacy quirks found while doing it, all **ported as-is**:

### "Colected In Georgia" credits the table but not the total

**Found:** `vwParcelsReports.cfm:267-273`. The four-branch attribution loop is:

```
if      ListFindNoCase(BemaGE, updaterUserName) -> CollectedGE[k] += …;  totalAmountGE += …
elseif  ListFindNoCase(BemaUS, updaterUserName) -> CollectedUS[k] += …;  totalAmountUS += …
elseif  updaterCountry eq "GE"                  -> CollectedGE[k] += …;  totalAmountUS += …   <-- here
elseif  updaterCountry eq "US"                  -> CollectedUS[k] += …;  totalAmountUS += …
```

The third branch credits the amount to the **Georgia** per-person table but adds it to the
**USA** total. So for any operator who is billed in Georgia but is not on the hardcoded
`BemaGE` username list, the "Colected In Georgia" rows do not sum to the "Colected In Georgia"
total, and the "Colected In USA" total is inflated by that amount. The two username-list
branches and the `US` branch are all self-consistent; only this one is not.

**Ported verbatim** (`parcelReports.ts`'s `collected…` loop, with the offending line
explicitly commented so a future cleanup pass can't mistake it for a typo). Reproduced rather
than corrected because these two tables are used to reconcile physical cash against what each
office collected — a silent correction would show numbers that disagree with the old system on
the same data, which is a real financial discrepancy, not a fix. Verified end-to-end against a
real database: one GE-billed off-list operator collecting 50 yields GE rows summing to 70, a
GE total of 20, and a US total inflated to 120.

### `Remain Payment` silently drops parcels with no second payment method

**Found:** `parcels-reports.cfm:44` — `AND p.paymethod2 != 'Dept' AND p.paymethod2 != 'Depth'
AND p.paymethod2 != 'Debt'`. These are three NULL-propagating comparisons, so a parcel whose
`payMethod2` was never set is **excluded from the Remain Payment table entirely** — the
opposite of the natural reading ("no debt method set, so include it"). Almost every parcel that
never took a partial payment falls in this hole.

**Ported as-is.** Prisma's `{ not: … }` compiles to a bare `<> $1` (verified against Postgres),
so the three-valued behaviour matches MSSQL's without a special case. An earlier draft of this
port had "helpfully" included the NULLs, which would have made the table disagree with legacy
on nearly every window.

### `'Kote '` — a list entry that can never match

**Found:** `vwParcelsReports.cfm:248` — `BemaUS = 'Kote,gzavnili,Kote ,Datunia,Badri'`. The
third element has a trailing space, making it a distinct list element from `Kote` that
`ListFindNoCase` can never match against a real username.

**Ported as-is** (kept in `BEMA_US_USERNAMES`). Harmless, but removing it would be editing
legacy data under the guise of porting it.

### `CreditCard GEO` relabel that matches nothing

**Found:** the Payment Colected block remaps `CreditCard GEO` -> `Credit Card GE`, but no
screen in the legacy app stores that spelling — every payment-method dropdown writes
`CreditCard GE`. The branch is dead against data this app produces.

**Ported as-is**, since legacy-imported rows may well carry the old spelling and the branch
costs nothing.

### The `Unknown`/`Linoli` customer buckets remain unreachable

**Unchanged from the first pass, and this one really is a data-availability limit, not a
decision:** both branches key off hardcoded legacy MSSQL customer GUIDs
(`58133650-…`/`581ACE56-…`) which cannot exist in this schema until the ETL runs. Both rows
still render (always 0), matching the legacy layout.

## Parcels Reports 2 (`parcels-reports-2-v2.cfm`) — 2026-08-01

Ported the `-v2` controller/view pair specifically (`parcels-reports-2-v2.cfm` +
`vwParcelsReports2-v2.cfm`), not the plain `parcels-reports-2.cfm`/`vwParcelsReports2.cfm` —
see "Two unreachable branches" below for why.

### The chicago/NULL exclusion via `ur.username not like '%chicago%'`

**Found:** `parcels-reports-2-v2.cfm:181`. `ur` is `parcels.tracking_received_by` LEFT
JOINed to `users`. When a parcel has no `tracking_received_by` set, `ur.username` is NULL,
and `NULL NOT LIKE '%chicago%'` is NULL — not true — so the row is dropped by the WHERE
clause. The visible effect: **this report only ever shows parcels that have a
"received by" admin recorded**, and that admin's identity is exactly what the "Received by"
column renders — a parcel processed without one (or by the literal `chicago` test/branch
account) never appears here at all, regardless of how it was paid.

**Ported as-is** (`parcelSalesReport.ts`: `parcel: { trackingReceivedBy: { not: null, notIn:
chicagoAdminIds } }`). Verified end-to-end: a seeded parcel with `trackingReceivedBy = NULL`
and a seeded parcel whose receiving admin's username contains `chicago` were both correctly
absent from the API response, while an otherwise-identical parcel with a normal receiving
admin appeared.

### `ph.updaterID NOT IN (excludeAgentIds)` also drops every NULL-updater row

**Found:** `exclude-agents.cfm`'s single hardcoded id (`26259424-…`, "Exclude MR from
financial reports due to role change") is applied via `NOT IN`, which is NULL — not true —
for any row whose `updaterID` is itself NULL. Unlike the sibling "Parcels Reports" screen
(which needs `NOT: { updater: { adminRole: 'BemaAgent' } }` specifically so it *keeps*
NULL-updater rows, e.g. `money-collect.cfm`'s "Online" backfill), this report's own filter
requires the opposite: a bare `updaterId: { not: EXCLUDED_AGENT_ID }`, which correctly
excludes both the one hardcoded id and every NULL. Verified: a seeded payment event with
`updaterId = NULL` did not appear in the API response.

**Ported as-is.** The hardcoded id itself matches nothing yet (no legacy user data has been
imported), same status as the sibling report's `UNKNOWN_CUSTOMER_ID`/`LINOLI_CUSTOMER_ID`.

### Column "Paid" vs column "Debt": two different sentinels for the same Debt-financed slot

**Found:** `vwParcelsReports2-v2.cfm`'s "Paid" column (~line 319) sets a Debt-financed
`payamount1`/`payamount2` to `""` (empty string), while the "Debt" column (~line 355) sets
the *same condition* to `0`. Because `""` is falsy-for-presence and `0` is not, the "Paid"
column's blank/debt-fallback branch is reachable (a fully debt-financed "Paid" parcel shows
its `debt` figure instead of a blank), while the "Debt" column's equivalent fallback branches
are dead — the `tpayamount1 neq ""` check is always true once the slot is zeroed rather than
blanked, so `debtR = debt - tpayamount1 - tpayamount2` is the only branch that ever runs.

**Ported as-is**, deliberately keeping the two sentinels distinct (`computeRowDisplay` in
`parcelSalesReport.ts` uses `null` for column "Paid" and `0` for column "Debt") rather than
unifying them — see the test file's two dedicated cases for exactly this distinction.

### PayPal is only captured via `OnlineSource`, never via a literal "PayPal" `payMethod`

**Found:** `getTotals()`'s `data.Paypal` bucket is populated **only** by the
`tt.OnlineSource eq "PayPal"` branch. `sortPayments()` (the fallback for every other payment
method) checks for `"card"`/`"cash"`/`"check"` substrings but has no PayPal branch — a
payment event whose `payMethod` is literally `"PayPal"` without `OnlineSource` set
contributes to no total bucket at all and is silently dropped from `ttl`/`tbt`.

**Ported as-is** (`sortPayments`'s comment and the matching test — "drops a method matching
no bucket … silently"). The client-side live-recalc ("count2") totals happen to catch this
case anyway, since they bucket by substring match against the Payment Type text directly
(no `OnlineSource` dispatch) — a difference between the two totals sources that is itself
inherited from legacy (`getTotals()` vs `getFilteredSum()` are two independently-written
mechanisms there too, not a shared implementation).

### Service type filter dropdown is missing "Cargo"

**Found:** `vwParcelsReports2-v2.cfm`'s Service type `<select>` offers exactly `Express` /
`Regular` / `Unknown` / `Linoli` — `Cargo` (a real `parcels.service` value) has no option, so
a Cargo parcel is simply unselectable via that particular filter (still visible/unfiltered
otherwise; the "Unknown"/"Linoli" options don't match anything either, since `service` never
literally holds those strings — they're customer-bucket labels borrowed from the sibling
report's Total Sale block, not real service values).

**Ported as-is** (`SERVICE_OPTIONS` in `ParcelsSalesReportPage.tsx`, four options, no Cargo).

### Two unreachable branches: the plain (non-`-v2`) screen, and `fromMC=0`

**Found:** `lytBema.cfm`'s "Parcels Reports 2" nav entry links only to
`parcels-reports-2-v2.cfm` with no query string; every other in-app link to this screen
(the commented-out "Received by" link in the view, `vwMoneyCollect.cfm`'s link) also always
passes `fromMC=1`. Two consequences: (1) the plain `parcels-reports-2.cfm`/
`vwParcelsReports2.cfm` pair (no `exclude-agents.cfm`, no `updaterID NOT IN` filter) has no
live entry point and was not ported; (2) within the `-v2` controller itself, the `fromMC eq
1` branch is the only one ever exercised — the `fromMC neq 1` branch (a different `FROM
parcels p LEFT JOIN ParcelHistory …` query shape that also selects `updaterr.typeId`) is
dead code.

**Not reachable, nothing to port** for both. A consequence of (2) worth calling out
separately below.

### The `isDefined('typeId')` branch inside `pmshow`'s condition is always false

**Found:** `pmshow`'s derivation is `isDefined('paymethod') AND (payMethod eq "balance" OR
(isDefined('typeId') && FindNoCase('card', paymethod1_t) AND (typeId neq 1 OR paymethod eq
"Authorize.net")))`. `typeId` (`updaterr.typeId`) is only ever selected in the `fromMC neq 1`
query branch — see above — so on the only reachable path, `isDefined('typeId')` is always
false and the whole second OR-arm can never be true. `pmshow` therefore collapses to: the
event's own `payMethod` when it equals `"balance"`, else the parcel's `payMethod1`
(`OnlineSource`-overridden for Authorize.net/PayPal collections).

**Ported the collapsed form** (`computeRowDisplay`'s `pmshow`), with the reasoning recorded
in a code comment rather than transcribing the always-false branch literally.

## Money Collect (`money-collect.cfm` / `bema/ajax/moneyCollect.cfm`) — 2026-08-01

### The online-payment backfill INSERT is not portable — no `transactionId` link in the redesigned schema

**Found:** `money-collect.cfm`'s POST branch runs an INSERT before the report query, backfilling
`parcelhistory` "Paid" events from online payments that have never had any non-blank-`paymethod`
history row: `FROM payments p, invoices i, invoices_items ii, parcels pp WHERE ... AND
i.transactionid = p.transactionid AND ... AND ii.ParcelId not in (select parcelid from
parcelhistory where paymethod is not null and paymethod != '')`. The join key between `payments`
and `invoices` is `transactionid`. The redesigned schema (`prisma/schema.prisma`, per
`docs/migrations/04-postgres-schema-design.md`) has no `transactionId` on either `Payment` or
`Invoice` — `Payment` only carries `userId`/`paymentDate`/`amount`/`paymentMethodId`, correlated
to `Invoice` only loosely through the owning user, not a per-transaction key.

**Open, needs a decision if it matters going forward** — there is no way to reproduce this
backfill's join in the current schema at all, so it was not implemented (`moneyCollect.ts`'s
`getMoneyCollectReport` reads `parcel_history` as-is, same as the sibling reports, with no
backfill step). If online payments still need to land in `parcel_history` as "Paid" events for
this report to see them, that has to happen at write time when a payment is recorded (wherever
`Payment` rows are created in this codebase), not as a report-time backfill — a `transactionId`
column would need to be added to `Payment`/`Invoice` first if the legacy backfill's exact
per-transaction matching semantics are wanted.

### `validateLogin`'s group-membership check is dead code — the modal's password re-auth accepts any bema admin, not just `WEBSITE_ADMINISTRATOR`

**Found:** `bema/ajax/moneyCollect.cfm` calls `userDAO.validateLogin(form.collectorId,
form.password, GROUPS.WEBSITE_ADMINISTRATOR)`. `MSSQLUserDAO.cfc`'s `validateLogin` accepts a
`groupId` argument, but the actual membership check against it is commented out
(`<!--- <cfelseif qryLoginUser.MaxGroupId lt arguments.GroupId> ... --->`). At runtime this means
the re-auth step accepts *any* active bema admin account's credentials, regardless of role — not
specifically `WEBSITE_ADMINISTRATOR`.

**Ported as-is, matching the real runtime behavior rather than the misleading call site**: the
collect API route (`api/bema/parcels/money-collect/collect/route.ts`) re-authenticates via
`loginBemaUser` — the same function the login screen itself uses — which only requires
`adminRole` to be set, not a specific one, matching what `validateLogin` actually does today.

### `bema/ajax/moneyCollect.cfm` has no session/role gate at all — deliberately hardened, not ported

**Found:** unlike every other bema screen/ajax endpoint, `money-collect.cfm`'s ajax write target
has no `<cfmodule template="/custom_tags/require.cfm" ...>` call — the endpoint accepts a POST
from anyone, gated only by the inline password re-auth described above.

**Deliberately not ported** — this is a real unauthenticated-write-endpoint gap in legacy, not a
business-logic quirk, and reproducing it would be introducing a genuine security vulnerability
into the new codebase rather than faithfully replicating one. The port's collect route requires a
valid bema session (`requireBemaSession`, same `BemaStandard`/`BemaAdministrator` roles as the
report page) in addition to the password re-auth. See the route file's own comment.

### `getUsers(typeId=1)` with no `active` argument returns inactive accounts too

**Found:** the "Manager" select's source, `userDAO.getUsers(recordsPerPage=99999, currentPage=1,
orderBy="LastName,FirstName", typeId=1)`, is called with no `active` argument.
`MSSQLUserDAO.cfc`'s `getUsers()` defaults `active` to `""`, and only adds the `Active` filter
when that argument is non-blank — so this call returns **both active and inactive** BEMA
accounts, unlike the sibling "Parcels Reports 2" screen's `bemaUsers` list (which does filter
`active=1`).

**Ported as-is** (`getMoneyCollectReport`'s `managers` query has no `active` filter — see its doc
comment).

### The "Agents Name" deep link to a per-agent report was simplified

**Found:** the report's Agents Name cell links to
`/bema/parcels/parcels-reports-2.cfm?fromMC=1&username=<agent>&datestart=...&dateend=...` — the
**plain**, non-`-v2` report (not the one actually ported as "Parcels Reports 2", which is `-v2`).
The plain variant differs from `-v2` only by omitting the `exclude-agents.cfm` filter (so it can
show even the one hardcoded excluded agent's own report) and using an older view template
(`vwParcelsReports2.cfm`, not `-v2`); it otherwise supports the same `url.username` filter that
`-v2` also implements (`updaterr.username = url.username`).

**Simplified, not fully ported**: building a third report variant purely to bypass one hardcoded
agent's exclusion filter was judged out of scope for this port. The "Agents Name" cell currently
renders as plain text (not a link) rather than linking anywhere; a future pass could wire it to
the already-ported `/bema/parcels/reports-2` with a `username` filter added to that service/route
if this drill-down is actually used in practice.

### Only one "Cash" bucket — no separate "Cash GE" total, even though "Cash GE" is a real `payMethod`

**Found:** `vwMoneyCollect.cfm`'s bucketing (`totals2`) has a single `Cash` key populated by
`findnocase('Cash', key)` — a `payMethod` of `"Cash GE"` matches this same branch (checked before
`Card`/`Card GE`, which are the only two buckets legacy splits US/GE), so US and Georgia cash are
combined into one column, unlike Credit Card which does get a GE-specific bucket.

**Ported as-is** (`bucketPayMethod`'s `cash` branch has no GE variant; see its test coverage).

---

## Site Settings (`bema/config/settings.cfm` / `vwSettings.cfm`) — 2026-08-01

### "Export Airway"'s Airway Bill/Date/Consignee were guessed as static constants — they aren't

**Found:** the earlier port of `export-airway/route.ts` (2026-07-31/08-01, see the entry above)
had no `airway.cfm` source available and inferred its content from one real sample export
(`tmp/airway_export.csv`), concluding `Airway Bill:`/`SHIPMENT DATE:`/`CONSIGNEE:` were fixed,
hardcoded values baked into every export — and that the AWB code came from `config.regAwb`
falling back to `config.expAwb`. With `bema/parcels/airway.cfm`'s real source now available
(found while porting this settings screen, since `Consignee`/`Airway Bill`/`Airway Date` are
all fields *this* screen edits): all three are read live from `config` on every export —
`config.getAIRWAYBill()`, `config.getAIRWAYdate()` (formatted `mm/dd/yyyy`), and
`config.getCONSIGNEE()` (HTML-tag-stripped). None of them come from `regAwb`/`expAwb` — those
are the separate *trip* AWB codes used by the "Set AWB" bulk parcel operation, not this
manifest's own bill number. The sample CSV just reflected whatever `config` held at export
time, including a Consignee value containing literal `&nbsp;` entities someone had typed in
(legacy's tag-strip regex doesn't touch entities) — not a static literal to hardcode.

**Ported as-is, correcting the earlier guess**: `export-airway/route.ts` now reads
`config.airwayBill`/`config.airwayDate`/`config.consignee` (new `Config` model fields, this
change) instead of the hardcoded `CONSIGNEE` constant and the wrong `regAwb`/`expAwb` fallback.
`SHIPPER NAME` and both `AIRPORT OF` fields are confirmed genuinely hardcoded in `airway.cfm`
itself, not `config`-sourced — those stay as literals, unchanged.

### "Export Airway"'s manifest body (receiver rows, weight/value totals) — open, not ported

**Found:** `airway.cfm` also runs a live query for parcels/receivers with `tripdate =
config.AirwayDate`, sums `weight`/`value` into `NO. OF PIECES`/`TOTAL ACTUAL WEIGHT`/`TOTAL
Value`, and emits one CSV data row per receiver. The current port still always emits an empty
data-row table under the static header.

**Open — needs a decision.** This is substantially more than a settings-config read (a parcels
query keyed on `tripdate`, itself not a field this schema's `Parcel` model currently exposes for
filtering) — porting it is really extending the "Export Airway" parcels-list feature, not the
Site Settings screen this change is about. Flagged here rather than silently left unmentioned.

### Trip-info's Cargo dates were wrongly assumed to not exist in legacy at all

**Found:** `trip-info/route.ts`'s original comment claimed "Cargo has no equivalent
`dt_cargo_*`/awb columns in this schema (there weren't any in legacy either)". The `awb` half is
correct (`Config.cfc` has no `CargoAWB` getter/setter — only Regular/Express have their own AWB
column) — but the `dt_cargo_*` half was wrong: legacy's `Config`/`MSSQLConfigDAO` has
`dtCargoShip`/`dtCargoEst` columns, editable on `settings.cfm`'s own "Cargo Services" section,
just like Regular/Express.

**Ported as-is, correcting the earlier assumption**: `Config` gained `dtCargoShip`/`dtCargoEst`
(this change), and `trip-info/route.ts`'s cargo branch now returns their real values instead of
hardcoded `null`. Cargo's `awb` stays `null` — that part of the original comment was correct.

### `siteMessage2` is confirmed write-only and dead — not modeled

**Found:** `settings.cfm`'s POST handler saves `form.sitemessage2` (`param default = ""`) to
`config.siteMessage2` on every submit, but `vwSettings.cfm` has no `<textarea name="sitemessage2">`
or any other input for it anywhere in the view. Since HTML forms never submit fields that don't
exist, `form.sitemessage2` always falls back to its blank `param` default on every real submit —
meaning every legacy settings save silently overwrites `siteMessage2` to empty, regardless of
what it held before. No view anywhere reads `config.getSiteMessage2()` either (confirmed by
grepping the whole legacy `.cfm`/`.cfc`/`.html` tree) — it's entirely write-only *and* the one
write path that exists always writes blank.

**Not reachable, nothing to port.** Since nothing ever reads the column and the one write path
is a no-op (always writes the same blank value), there is no observable behavior to reproduce.
Not added to the `Config` model.

### `siteMessage` ("Header Site Message") has no reachable display consumer in this app

**Found:** `config.getSiteMessage()` is read in exactly one place — `views/layouts/
default.html`, the layout used only by `error.cfm` (the CFML exception page) — and rendered
into a `.tga2` div. This Next.js app has no equivalent custom error-page layout (Next's own
`error.tsx`/`not-found.tsx` mechanism doesn't render arbitrary legacy CFML layouts), so there is
currently no page in `gzavnili-next` that would display this value.

**Ported as data, not yet as display.** `siteMessage` is modeled on `Config` and editable on the
new Site Settings screen (parity with legacy's editable field), but has no rendering consumer
here — same "not-yet-built consumer" situation as declared/non-declared pricing below, not
treated as dead since an admin genuinely can set it and a future error-page build could read it.

### Declared/non-declared parcel pricing — stored, no consumer yet

**Found:** `declaredPrice`/`nonDeclaredPrice` are only ever read by `lytBema.cfm`'s `dbConfig`
JS object, consumed by `parcels-online-add-2.js`'s declared-vs-non-declared pricing toggle on
the (different, not-yet-fully-ported) online parcel-add flow — distinct from this project's
already-ported batch "Add Parcel" screen (`parcelBatchAdd.ts`/`batchPricing.ts`), whose pricing
model has no declared/non-declared concept at all.

**Ported as data, no consumer yet.** Both fields are modeled on `Config` and editable on the
Site Settings screen so the values exist and are ready once/if that pricing toggle is ported;
no attempt was made to wire them into the existing batch-pricing service, since that would be
inventing a mechanism the existing ported screen's legacy counterpart never had.

---

## Payment Preferences (`bema/config/payment.cfm` / `vwPaymentConfigForm.cfm`) — 2026-08-01

See docs/decisions/0020-payment-config.md for the full picture; the individual findings below.

### Most of the payment settings screen is HTML-commented-out — not live

**Found:** `vwPaymentConfigForm.cfm`'s Gateway `<select>` has exactly one `<option>`
(`authorizenet`); the PayPal/PayFlowPro/Sage merchant-credential blocks are one HTML comment;
and everything from Cybersource onward — Payment Methods checklist, Credit Card Types
checklist, a duplicate "Paypal Express Checkout" enable toggle, State Taxes, Fees — is a second,
much longer HTML comment running to just above the Save button. Four hidden inputs
(`payment_methods=CREDITCARD`, `card_types=VISA,MASTERCARD,DISCOVER,AMEX`, `fee_amount=0`,
`fee_type=$`, `paypal_enabled=true`) submit fixed constants in place of all of that.

**Ported as-is**: only the Gateway select (rendered disabled, one option — matches "no live way
to change it"), the two Authorize.Net fields, and the four live Paypal Express Checkout fields
are built (`PaymentConfigForm`). The hidden-constant fields are written server-side on every
save (`gateway: "authorizenet"` in the PATCH handler) rather than round-tripped through the API,
since they can never actually vary — see the next two findings for why the rest isn't modeled
at all.

### `GatewayPassword`/`GatewayOther` are read back and rewritten unchanged — no live path sets them

**Found:** `payment.cfm`'s POST handler only calls `paymentConfig.setMerchantPassword(...)`/
`setMerchantOther(...)` inside the `paypal`/`payflowpro` branches of its `if (form.gateway eq
...)` chain — never inside the `authorizenet` branch, the only one any real request through this
UI ever takes. Since `paymentConfig` is loaded from the DB first
(`paymentDAO.retrievePaymentConfig()`) and only selectively overwritten per branch, these two
columns just get read back and written to the same value they already held, forever — a no-op,
not data loss, but also nothing an admin can ever actually set through this screen.

**Not reachable, nothing to port.** Not added to the `Config` model.

### Every "Save" on this screen destructively wipes the `paymentmethods` table

**Found:** `MSSQLPaymentDAO.updatePaymentConfig()` does an unconditional `DELETE FROM
paymentmethods` (no `WHERE`) inside the same transaction as the `config` row update, then
re-`INSERT`s only from `paymentConfig.getPaymentMethods()`/`getCreditCardTypes()` — the two
lists the hidden inputs always fix to `[CREDITCARD]`/`[VISA,MASTERCARD,DISCOVER,AMEX]`. Any
`paymentmethods` row for a `PaymentMethodId` outside those two fixed lists — including any
`TypeId=1` payment method other than `CREDITCARD` that might have existed — is permanently
deleted on every save and never comes back, since nothing in this screen can submit anything
else.

Compounding this: `payment.cfm` also loops `for key in paymentMethods: paymentDAO.
updatePaymentDescription(key, form['pay_#key#'] ?? '')` to save each payment method's
`CheckoutDescription` — but the `pay_#key#` textareas that would supply that value live inside
the same commented-out block as the Payment Methods checklist. Since no `pay_#key#` field is
ever actually submitted, this loop writes `''` for every key, every time. Combined with the
DELETE above (which drops `CheckoutDescription` to its column default/NULL on re-insert
regardless), **every single "Save" click on this screen permanently blanks all payment-method
checkout descriptions**, in addition to deleting any non-`CREDITCARD` payment method row.

**Open — needs a decision.** This is a real, severe legacy bug (silent data loss on routine use
of an admin screen), but nothing in `gzavnili-next` reads a `paymentmethods`/checkout-
description table yet — no checkout/orders domain exists in this schema at all. Building a
relational table here solely to reproduce a mechanism whose only observable effect is deleting
whatever was in it isn't ported; flagged for whenever the checkout/orders domain is actually
designed, at which point this needs an explicit call (reproduce the wipe for fidelity, or treat
it as the bug it is).

### State Taxes: hidden input always submits `[]` — every save deletes all tax rows

**Found:** the live form has `<input type="hidden" name="taxes" id="taxes" value="[]" />`; the
JS that would ever populate it (`addTaxRow`, wired to `btnAddItem`) lives entirely inside the
same dead HTML comment as the State Taxes table itself. `updatePaymentConfig()` then diffs the
submitted (always-empty) tax list against the DB's `taxes` table and deletes every row not in
it — i.e., every row, every time.

**Open — needs a decision**, same reasoning as the `paymentmethods` finding above: no `taxes`
table/consumer exists yet in this schema. Not modeled.

---

## Messages / SMS list (`bema/messages/messages.cfm` / `sms.cfm`) — 2026-08-01

See docs/decisions/0021-bema-messages.md for the full picture; the individual findings below.

### The "Message" column shows the message *type* label, not the message body

**Found:** `views/messages/messages.cfm`'s browse table has a column headed "Message"
(`<th ...>Message</th>`), but the row template renders `#enName#` in that cell
(`<td>#enName#</td>`) — `enName` is `MessageTypes.enName`, the category label ("We just got
your parcel(s)", "Payment Reminder", ...) from the `LEFT JOIN MessageTypes`, not `Message`,
the column actually holding the body text (which is selected by the query but never displayed
anywhere on this screen). Every row's "Message" cell shows its type label instead of any of
its actual content — the real message text is only visible via `message_view.cfm`, not built
here (see docs/decisions/0021-bema-messages.md).

**Ported as-is**: the "Message" column in `MessagesListPage` renders `messageTypeLabel`
(joined from `MessageType.label`), not `body` — reproducing legacy's actual displayed output,
not what the header name implies it should show.

### Four `url` params are declared but never applied to either query

**Found:** both `messages.cfm` and `sms.cfm` declare `url.active` (default `"1"`), `url.sort`
(default `"Username"`), `url.dir` (default `"desc"`), and `url.grp` (default `""`) via
`cfparam`, but none of the four ever appears in either screen's SQL `WHERE`/`ORDER BY` — both
queries always order by `dtCreate desc` with no status filter, regardless of what these
params hold. Almost certainly leftover boilerplate copied from the Parcels list screen (which
does use `active`/`sort`/`dir` for real).

**Not reachable, nothing to port.** No filter/sort controls for these are exposed in
`MessagesListPage`/`SmsListPage`; both list endpoints always order by `createdAt desc` and
never filter by an active/status flag.

### Messages search matches `messageFormatted`, a column absent from the list's own `SELECT`

**Found:** `messages.cfm`'s search clause is `subject LIKE ... OR messageFormatted LIKE ...`,
but the query's `SELECT` list has no `messageFormatted` column — only `Message` (aliased
nowhere, selected as-is) is fetched. Whatever `messageFormatted` actually is in the legacy
`messages` table (a pre-stripped/formatted copy of `Message`, presumably, but not confirmed —
no DDL for this table was available to check) isn't visible in this screen's own output at
all, dead-code-adjacent from the browse list's perspective even though the filter it drives is
live.

**Approximated, not literally ported**: `GET /api/bema/messages`'s search matches `subject`
and `body` (`Message`'s equivalent) — the closest available proxy, since `messageFormatted`
isn't modeled (no confirmed source column to port it from) and `Message`/`body` is the only
message-text column this screen's query actually returns.

---

## Add Online Parcel (`bema/parcels/parcels-online-add-2.cfm`) — 2026-08-01

See docs/decisions/0022-parcels-online-add.md for the full picture; the individual findings
below.

### The server's create-time "status allow-list" check is dead code — it's a plain existence check

**Found:** `parcel2 = read(byTrackingnum=true); if (parcel2.getTrackingnum() neq "" or
(trackingNumExists(...) and not listFind(status, 'awaiting,onhold,new,notonhold'))) reject`.
`read(byTrackingnum=true)` and `trackingNumExists()` (both in `MSSQLParcelDAO.cfc`) run the
identical `TrackingNum = <input>` query against the identical data — whenever the first clause
is false, the second clause's `trackingNumExists` half is necessarily false too (same query,
same input), so the status check after the `AND` can never be the deciding factor. Confirmed
by reading both DAO method bodies, not assumed from the call site.

**Ported as-is**: `createOnlineParcel()`'s uniqueness guard (`TrackingNumberConflictError`) is
a plain `trackingNumExists()` check — reject if the tracking number exists anywhere, regardless
of status — not a status-aware one.

### Three different "can this tracking number be upgraded" allow-lists, not one

**Found:** the tracking-lookup success handler gates the edit UI on
`['awaiting','notonhold','new','delay']`; the pre-submit re-check right before "Save and add
another" actually submits uses the wider `['awaiting','onhold','new','notonhold','delay']`;
and (per the finding above) the server's own create-time check isn't status-aware at all. All
three genuinely differ and none of them agree with each other.

**Ported as-is**, as two separate constants (`ALLOWED_FOR_UPGRADE_UI`/`ALLOWED_FOR_PRESUBMIT`
in `ParcelOnlineAddPage.tsx`) plus the existence-only server guard above — not unified into one
"the correct list."

### The dimensional-weight swap-in prices at 2-decimal precision, displays at 4

**Found:** `calcDebt()` writes `d.toFixed(4)` into the `#dimweight` field, but when the
dimensional weight exceeds actual weight and gets substituted in for pricing, it's re-rounded
via `formatNumber()` — `Math.round(n*100)/100`, i.e. 2 decimals — before being multiplied by
the rate. The number that determines the price and the number the operator sees in the Dim
Weight field are not always the same number.

**Ported as-is** in `calculateOnlineDebt()` (`src/lib/parcels/onlinePricing.ts`) — the returned
`dimWeight` (display) uses 4-decimal rounding; the internal value used for the debt calculation
uses 2-decimal rounding when it's the one that wins. Covered by
`onlinePricing.test.ts`'s "dimensional weight is used instead of actual weight" case.

### The delivery-method radios have zero effect on price

**Found:** the Region (+2.25)/Delivery (+1.25) fee add-ons are gated by
`jQuery('[name=sdelivery]:selected').val()`. `:selected` is a jQuery pseudo-class that only
ever matches `<option>` elements inside a `<select>`; `sdelivery` is rendered as radio
`<input>`s (`<input type="radio" name="sdelivery" value="Pickup" checked />` etc.), so that
selector produces an empty jQuery set on every evaluation, `.val()` on it is `undefined`, and
neither `undefined == 'Region'` nor `undefined == 'Delivery'` is ever true. Picking Pickup vs.
Delivery vs. Region has no effect on the calculated debt, for any parcel, ever.

**Ported as-is**: `calculateOnlineDebt()` takes no delivery parameter at all — there's no
delivery-dependent branch to reproduce.

### A brand-new online parcel is always Regular + Pickup — no control can change it

**Found:** the Service/Delivery radio row (`.serviceSelect`) is shown only inside the
tracking-lookup's "found an existing, upgradable parcel" success branch.
`trackingNotFound()` — the path every genuinely new parcel takes — explicitly adds `.hide` to
`.serviceSelect` and never removes it. The static HTML's own `checked` attributes (Regular,
Pickup) are therefore the only values a parcel created from scratch through this screen can
ever have.

**Ported as-is**: create-mode in `ParcelOnlineAddPage` never renders the Service/Delivery
radios; the create payload hardcodes `service: 'Regular'`.

### The receiver's postal code is silently wiped on every save through this screen

**Found:** `receiver.init(address = new Address(..., postalCode = form.postalcode, ...))`
always passes `form.postalcode` — but no `<input name="postalcode">` exists anywhere in
`vwParcelsOnlineAdd2.cfm`, so it's permanently `""`. This applies even when the operator picks
an *existing* receiver from the dropdown and only means to update their weight/tracking info —
that receiver's postal code gets overwritten to blank as a side effect.

**Ported as-is**: `createOnlineParcel()` always passes `postalCode: ''` to `upsertReceiver()`.

### `goCountry()` is called but not defined anywhere reachable from this page

**Found:** `goUser()`'s last statement is `goCountry();`, a function defined in various
*other* bema screens' own inline `<script>` blocks (`vwUserEditForm.cfm`,
`vwParcelsUpdate.cfm`, etc.) — none of which this page includes. Calling it here would throw
`ReferenceError: goCountry is not defined` in a real browser, with no observable effect since
it's the last statement in its callback and nothing downstream depends on it running.

**Not reachable, nothing to port.**

### `firstnamex`/`lastnamex` and the inline customer-edit box are confirmed dead

**Found:** the "disabled, alternate" receiver name inputs are gated by
`ListFind(session.buser.listGroups('ADMINISTRATOR'), session.buser.getGroupId()) or 1` — the
`or 1` makes the condition always true, so only the ordinary editable `firstname`/`lastname`
fields ever render; the alternate branch is unreachable. Separately, the entire inline
"Save"/"Update" customer box (`.customerInputs`, `.saveCustomerBtn`, `doCustomerInfo()`) is
HTML-commented-out in the view.

**Not reachable, nothing to port** for either.

### `form.balance` is declared but never used

**Found:** `<input type="hidden" name="balance" id="balance" value="" />` with a matching
`cfparam name="form.balance" default=""`, but `form.balance` is never read anywhere in the
POST handler — not part of `parcel.init(...)` in either branch.

**Not reachable, nothing to port.**

---

## Change Parcel status (`bema/parcels/parcels-change-status.cfm`) — 2026-08-01

See docs/decisions/0023-parcels-change-status.md for the full picture; the individual
findings below.

### `applyPaidOperation()` always overwrote `payMethod1`/`payAmount1`, even blank — legacy doesn't

**Found:** `MSSQLParcelDAO.cfc`'s `doOperation('paid')` only sets `payMethod1`/`payAmount1` in
its `UPDATE parcels` when `arguments.payMethod1 neq ""` — the `bPaidDelivery = 1` half of the
same `SET` clause, and the invoice/payment raised right after, happen unconditionally
regardless. Every caller of this project's own `applyPaidOperation()` before "Change Parcel
status" always supplied a real payment method (the list toolbar's own zod schema requires
one), so this discrepancy had never been exercised — but "Change Parcel status" has no
payment-method field at all and calls it with `payMethod1: ''`, the first caller to actually
hit the blank case.

**Fixed to match legacy** (not left as a newly-introduced deviation): `applyPaidOperation()`
in `src/lib/services/parcelOperations.ts` now only writes `payMethod1`/`payAmount1` when
`payMethod1 !== ''`, same as legacy's conditional SQL. `bPaidDelivery`, the invoice, and the
payment are still written unconditionally either way.

### The Bema User field is silently dropped unless Location is also filled in

**Found:** `parcels-change-status.cfm`'s POST handler only writes `buser` inside the block
gated on `form.iLocation neq ""` (`parcel.init(buser = form.buser, Location = form.iLocation)`)
— there is no separate write path for `buser` alone. Selecting a Bema User with Location left
blank saves nothing; the selection is silently discarded.

**Ported as-is**: `applyParcelStatusChange()`'s `buser` write is gated on `iLocation`, not on
`buser` itself.

### `getParcel.cfm`'s two callers pass different `cutlength`/`withtrackingnum2` params

**Found:** "Add Online Parcel" calls `?cut=1&withtrackingnum2=1&trackingnum=...` (no
`cutlength`, so legacy's own default of 11 applies). "Change Parcel status" calls
`?cut=1&cutlength=12&trackingnum=...` (no `withtrackingnum2`, so legacy's default of `0`
applies — `TrackingNum2` is never matched at all for this screen). Two different effective
matching rules from the same ajax endpoint.

**Ported as-is**: `lookupParcelByTrackingNumber()` takes `cutLength`/`withTrackingNum2` as
options (defaulting to 11/`true`, matching the "Add Online Parcel" caller — the first one
built) rather than being hardcoded to one screen's params.

---

---

## Send SMS (`bema/messages/sms_add.cfm`) — 2026-08-01

See docs/decisions/0024-bema-send-sms.md for the full picture; the individual findings below.

### The tracking-lookup's `#parcelid` field is never actually set — a JSON key-casing bug

**Found:** `getParcel.cfm` serializes its response with `serializeJSON()`, which uppercases
every struct key regardless of how the CFML source wrote it — confirmed independently by
`parcels-online-add-2.js` (the same endpoint's other caller), which reads
`data.PARCELID`/`data.TRACKINGNUM`/`data.USERID`/`data.STATUS`, all uppercase, against the
exact same `data` struct `getParcel.cfm` builds. `sms-add.js`'s `byTrackingNumber()`, however,
reads `data.parcelId` (mixed case) — that key doesn't exist on the parsed response, so it's
always `undefined`. jQuery's `.val(undefined)` treats a `null`-ish argument as `""` (its
`val == null` branch), so `#parcelid` is explicitly set to an **empty string** on every
successful lookup, never the real id. `#receiverid` (read as `data.RECEIVERID`, correctly
uppercase) has no such bug.

**Ported as-is**: the port's tracking-number lookup only ever populates the receiver's
name/phone display, never a `parcelId` to submit — `SmsAddPage` has no `parcelId` state at
all. See the `sender`/`UserID`/`ParcelID` finding below for the combined effect.

### `#userid` is a hidden field that nothing ever sets

**Found:** `vwSmsAdd.cfm`'s `#userid` hidden input only ever gets its value from
`#form.userid#` (a GET-time echo of whatever was last submitted, `""` on a fresh page load) —
no `url.userid` param exists to seed it, and no line in `sms-add.js` (or anywhere else in the
file) ever calls `jQuery('#userid').val(...)`. Through the only reachable UI path (typing/
scanning a tracking number and pressing Enter), this field is permanently blank.

**Ported as-is**: no `userId` is collected or sent by `SmsAddPage`/`POST /api/bema/sms`.

### Every SMS sent through this screen has a blank `UserID`/`ParcelID`, despite the columns existing

**Found:** combining the two findings above — the tracking-number lookup that resolves a
receiver's name and phone for the operator never actually threads the matched parcel or its
owning customer through to the submitted form at all. The `Messages` row this screen inserts
always has blank `UserID`/`ParcelID`, even though the screen visually looks like it's linking
the SMS to a specific parcel.

**Ported as-is**: `POST /api/bema/sms` always creates the `Message` row with `userId: null`,
`parcelId: null` — not a placeholder for a follow-up, this is the actual observed legacy
behavior, confirmed by exercising the real flow end-to-end locally.

### The `sender` column holds the destination phone number for SMS, not the sending admin

**Found:** `sms_add.cfm`'s INSERT writes `form.phone1` (the receiver's phone) into the
`sender` column — compare `message_add.cfm`'s INSERT for regular messages, which writes
`form.sender` (defaulting to `session.buser.getId()`, the actual admin's user id) into the
same column. `sms_add.cfm` even declares an unused `form.sender` cfparam with that same
`session.buser.getId()` default, never referenced again in the file — an apparent copy-paste
of the pattern that just never got wired to the right variable. Neither `messages.cfm` nor
`sms.cfm`'s browse view ever displays `sender`/`sender_username` for SMS rows, so this has no
visible effect in legacy either.

**Not reachable as a literal port**: this schema's `Message.senderId` is a `Uuid` FK to
`User`, which can't hold a phone-number string at all (and legacy's own value here isn't a
real sender identity regardless — see the finding above). `POST /api/bema/sms` leaves
`senderId` null; the phone number is already captured correctly in `smsTo`.

### The "Tracking number not found" alert is dead code — both failure cases show the same message

**Found:** `byTrackingNumber()` checks `if (!response.DATA)` for the "not found" case, but
`getParcel.cfm` always returns a populated struct (every field `cfparam`-defaulted to `""`),
so `response.DATA` is truthy even when zero rows matched — that branch can never run. The
`else if (response.DATA.RECEIVERID == '')` branch catches both "no parcel matched" and
"parcel matched but has no receiver" identically, always showing "This tracking number do not
have receiver".

**Ported as-is**: `SmsAddPage`'s lookup shows that one alert for both cases; no separate
"not found" message exists.

### `CONTENT_ONLY` legacy role — the first real use found for it

**Found:** `sms_add.cfm`'s own `require.cfm` gate is
`WEBSITE_ADMINISTRATOR,CONTENT_ONLY,ADMINISTRATOR,AGENT_ADMINISTRATOR` — wider than every
other bema screen ported so far (`WEBSITE_ADMINISTRATOR,ADMINISTRATOR` only). `AdminRole`'s
own schema comment already anticipated this ("`CONTENT_ONLY`... never observed actually
gating any bema screen... add them back explicitly if a real use is found").

**Ported as-is**: added `BemaContentOnly` to the `AdminRole` enum (migration
`20260801201051_add_bema_content_only_role`) and widened this screen's own gate, the shared
tracking-lookup endpoint, and the receiver-read endpoint to include it. See
docs/decisions/0024-bema-send-sms.md.

### Gateway API keys are hardcoded in legacy source — moved to env vars in the port

**Found:** `messages.cfc`'s `sendsms()` has the Clickatell (US) and smsoffice.ge (GE) API
keys/sender ids written directly into the CFML source.

**Deliberate deviation, not a port of this specific detail**: `src/lib/services/smsGateway.ts`
reads `SMS_GATEWAY_GE_KEY`/`SMS_GATEWAY_US_KEY`/`SMS_GATEWAY_US_FROM` from the environment
instead — secrets don't belong in source control. The request shape/URL/params sent to each
gateway are otherwise reproduced exactly, including legacy's total lack of error handling
around the HTTP call (a failed/unreachable gateway still results in the `Messages` row being
inserted and "successfully sent" shown to the operator).

---

*(Older findings from before this log existed — e.g. `officeid = 999` "Need delivery" not
being a real FK, `isGeCitizen` being inferred rather than stored — are recorded in their
respective decision docs and PROGRESS.md instead; not backfilled here.)*
