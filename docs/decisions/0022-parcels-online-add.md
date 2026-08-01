# 0022 — "Add Online Parcel"

## Scope

Ports `bema/parcels/parcels-online-add-2.cfm` + `views/parcels/vwParcelsOnlineAdd2.cfm` +
`bema/include/js/parcels-online-add-2.js` (~900 lines together) — the tracking-number-driven
screen an operator uses to receive a single parcel: type a tracking number, and depending on
whether it matches an existing (not-yet-received) parcel, either finish receiving it or create
a brand-new one for a Known/Unknown/"Linoli" shipper. Completely independent of the batch "Add
Parcel" screen (`docs/decisions/0017-bema-add-parcel.md`) — different controller, different
pricing mechanism, different customer-resolution model. Gated the narrower
`WEBSITE_ADMINISTRATOR,ADMINISTRATOR` (→ `BemaAdministrator` only), same as Site Settings/
Payment Preferences, not the wider parcels-edit role set.

## The three different "can this tracking number be upgraded" allow-lists

Legacy genuinely has three, not one, and they disagree:

1. **The tracking-lookup keypress handler** (`parcels-online-add-2.js`) — gates whether a
   found parcel opens the edit-in-place UI at all: `['awaiting', 'notonhold', 'new', 'delay']`.
2. **The pre-submit re-check** just before "Save and add another" actually submits (a second,
   synchronous ajax call to the same lookup) — a *wider* allow-list:
   `['awaiting', 'onhold', 'new', 'notonhold', 'delay']`.
3. **The server's own create-time guard** (`parcels-online-add-2.cfm`'s POST handler) — see
   the next section; it turns out not to be a status check at all.

Reproduced as two separate constants (`ALLOWED_FOR_UPGRADE_UI`, `ALLOWED_FOR_PRESUBMIT`) in
`ParcelOnlineAddPage.tsx`, not unified into one "correct" list.

## The server-side create guard reduces to a plain existence check, not a status check

**Found:** the POST handler's insert branch does:
```
parcel2 = parcelDao.read(trackingNum=form.trackingnum, byTrackingnum=true)
if (parcel2.getTrackingnum() neq "" or (trackingNumExists(form.trackingnum) and not listFind(status, 'awaiting,onhold,new,notonhold')))
    reject
```
`read(byTrackingnum=true)` and `trackingNumExists()` (`MSSQLParcelDAO.cfc`) both run the exact
same `TrackingNum = <input>` query. Whenever the first clause (`parcel2.getTrackingnum() neq
""`) is false, the second clause's `trackingNumExists` half is *also* false — identical query,
identical input, identical database. CFML's `AND` binds tighter than `OR`, so the whole
expression collapses to: reject if *any* row already has this tracking number, full stop — the
status allow-list after the `AND` can never be the deciding factor.

**Ported as-is**: `createOnlineParcel()` uses a plain `trackingNumExists()` guard, not a
status-aware one. See `docs/findings.md`.

## The price calculator (`calcDebt()`) — ported to `src/lib/parcels/onlinePricing.ts`

A completely separate mechanism from `batchPricing.ts`'s `CustomerPricingRule`-based per-kg
schedule: this screen only ever reads `Config.declaredPrice`/`nonDeclaredPrice` (Regular) or
two hardcoded multipliers (Express ×7, Cargo ×3.5). Two bugs found and reproduced deliberately:

- **The dimensional-weight swap-in rounds to 2 decimals, not 4.** The `#dimweight` field
  itself always shows 4-decimal precision (`d.toFixed(4)`), but when the dimensional weight
  exceeds the actual weight and gets substituted into the pricing formula, it goes through
  `formatNumber()` first — a 2-decimal round. The number priced and the number displayed can
  genuinely differ in their last two decimal places.
- **The delivery-method radios (Pickup/Delivery/Region) have zero effect on price.** The fee
  add-on check is `jQuery('[name=sdelivery]:selected')` — `:selected` only ever matches
  `<option>` elements in a `<select>`; `sdelivery` is rendered as radio `<input>`s, so that
  selector is always an empty set and the `+2.25`/`+1.25` branches never run, for any delivery
  method, ever. Confirmed by reading the exact selector, not assumed.

Both in `docs/findings.md` with the full trace; both covered by
`src/lib/parcels/__tests__/onlinePricing.test.ts`.

## A brand-new parcel is always Regular + Pickup, with no control to change it

**Found:** the Service/Delivery radio row (`.serviceSelect`) is only ever un-hidden in the
tracking-lookup success branch for an *existing, upgradable* parcel. `trackingNotFound()` (the
path every genuinely new parcel takes) explicitly hides `.serviceSelect` and never shows it —
the static HTML's own `checked` defaults (Regular/Pickup) are therefore the *only* values a
newly-created online parcel can ever have; there is no way for the operator to pick Express,
Cargo, Delivery, or Region on a brand-new parcel through this screen.

**Ported as-is**: `ParcelOnlineAddPage`'s create-mode UI never renders the Service/Delivery
radios at all; `service` is hardcoded to `'Regular'` in the create-mode payload.

## Two hardcoded shipper placeholder accounts (`GZ20000`/`GZ20001`)

The Unknown/"Linoli" tabs assign the new parcel to one of two fixed legacy MSSQL GUIDs (with a
source comment recording their usernames). Those ids don't exist post-migration — same
situation as `agent-prefix-map.cfm`'s hardcoded GUIDs
(`docs/decisions/0017-bema-add-parcel.md`), except these two are load-bearing (the parcel's
actual owning customer), not cosmetic, so they can't just be dropped. Resolved by username
instead — `scripts/seed-parcel-shippers.ts` (wired into `bun run db:seed`) creates
`GZ20000`/`GZ20001` as ordinary `Customer` accounts; `parcelOnlineAdd.ts` looks them up by
username at save time. **This seed step is a deployment prerequisite** for the Unknown/Linoli
tabs to work at all — flagged here and in PROGRESS.md so it isn't missed.

## What wasn't ported, and why

- **The postal code field doesn't exist on this screen, but legacy still writes one.**
  `receiver.init(address = new Address(..., postalCode = form.postalcode, ...))` always passes
  `form.postalcode`, which has no corresponding `<input>` anywhere in
  `vwParcelsOnlineAdd2.cfm` — it's always `""`. Every receiver saved through this screen,
  *including an existing one picked from the dropdown*, has its postal code silently wiped to
  blank. Reproduced as-is (`upsertReceiver(..., { postalCode: '' })`) — see `docs/findings.md`.
- **`goCountry()` doesn't exist anywhere reachable from this page.** `goUser()` calls it as its
  last statement; it's defined in various *other* screens' own inline `<script>` blocks, none
  of which this page includes. A dead/broken reference (would throw `ReferenceError` in a
  browser console) with no observable effect since nothing depends on it running. Not
  reproduced.
- **The inline "Save"/"Update" customer box** (`.customerInputs`, `.saveCustomerBtn`,
  `doCustomerInfo()`, `bema/ajax/customerEdit.cfm`/`user.cfm`) — the entire block is
  HTML-commented-out in `vwParcelsOnlineAdd2.cfm`. Customers are picked via the
  `CustomerPicker` autocomplete only; there is no inline create/edit affordance on this screen
  in legacy either.
- **`firstnamex`/`lastnamex`** — the "disabled, alternate" receiver name fields, gated by
  `ListFind(session.buser.listGroups('ADMINISTRATOR'), session.buser.getGroupId()) or 1`. The
  `or 1` makes the condition always true, so the alternate (disabled) branch is unreachable
  dead code; only the ordinary editable `firstname`/`lastname` fields are ever rendered.
- **`form.balance`** — a hidden input (`<input type="hidden" name="balance" ...>`) declared via
  `cfparam` but never read anywhere in the POST handler. Confirmed dead.
- **Weight-blur auto-submit** *is* ported, deliberately, despite being unusual UX: blurring the
  Weight field on the Known-Shipper tab, with a customer and receiver already selected,
  immediately saves the parcel — `#weight`'s own `blur` handler in legacy, a real workflow
  shortcut operators rely on for fast entry, not an accident to leave out.
- **`session.notcheck`** (the "Do not check tracking number" toggle) is remembered
  server-side, per bema session, in legacy. This app's bema sessions carry no such arbitrary
  per-screen UI state, so it's kept in `localStorage` instead — the same idiom the Sidebar's
  collapsed state already uses. Same practical effect (stays on until explicitly turned off),
  different storage.
