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

**Open — needs a decision:** the "Payment method 2" / two "Amount" input fields are still
rendered in `ParcelAddPaymentSection`, matching what legacy's screen actually shows
operators (including `#paymentAmount` being marked `required="true"` even though nothing
reads it meaningfully). Keep them (faithful to the actual screen, warts included — the
"port bugs, don't fix them" rule argues for this) or remove them (they're confirmed inert
and could read as recording a payment that isn't). Not decided.

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

*(Older findings from before this log existed — e.g. `officeid = 999` "Need delivery" not
being a real FK, `isGeCitizen` being inferred rather than stored — are recorded in their
respective decision docs and PROGRESS.md instead; not backfilled here.)*
