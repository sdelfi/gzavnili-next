# 0028 — "Check on hold"

## Scope

Ports `bema/parcels/parcels-check-onhold.cfm` + `views/parcels/vwParcelsCheckOnhold.cfm` +
`bema/include/js/parcels-check-onhold.js` — a scan-driven screen for resolving on-hold
parcels one at a time: staff types/scans a tracking number, the screen shows the parcel's
service and either a "Still on hold" or "Remove from on hold" button, and clicking it
resolves the parcel. Gated `WEBSITE_ADMINISTRATOR,ADMINISTRATOR` → `BemaAdministrator` only,
same as "Add Online Parcel" and "Change Parcel status".

Reuses the tracking-number lookup already built for those two screens
(`lookupParcelByTrackingNumber()` in `src/lib/services/parcelOnlineLookup.ts`), called the
same way legacy's own `getParcel.cfm?cut=1&trackingnum=...` is here — no `cutlength` (so its
default of 11 applies) and no `withtrackingnum2` (defaults off). The lookup gained a `store`
field (`OnlineParcelLookup.store`) since this is the first screen that needs it.

## The resolve decision is re-derived server-side, not trusted from the client

Legacy's POST handler re-reads the parcel from the database and re-runs the same
store/value/contents check the page's own lookup already ran client-side, rather than
trusting whichever button the client happened to submit. Reproduced the same way:
`resolveOnholdCheck()` (`src/lib/services/parcelCheckOnhold.ts`) takes only a `parcelId`,
re-reads `store`/`value`/`contents`, and decides:

- **Still missing** (`store` empty, `value` null/zero, or `contents` empty) → the parcel
  stays on hold, but `bSentOnHold` is reset to `false` so the on-hold SMS reminder sweep
  (`onholdSmsSweep.ts`, `docs/decisions/0027-cron-notifications.md`) will nudge the customer
  again on its next run — legacy's own `UPDATE parcels SET bSentonHold = null`.
- **Present** → both hold flags clear (`bOnHold = false, bNotOnHold = false`), the same
  write the parcels-list "Remove from On Hold" action (`clear-hold` route) already makes,
  just reached from a different screen and gated on this decision rather than unconditional.

## Client hint vs. server decision use different thresholds — a real legacy inconsistency

**Found:** the page's own JS decides which button to *show* using
`data.VALUE < 1` (`bema/include/js/parcels-check-onhold.js`), but the POST handler's server
check is `parcel.getValue() eq 0` — not the same test. A parcel with `value = 0.5` shows the
"Still on hold" button client-side, but the server's `eq 0` check would resolve it as "remove
from on hold" if that button were somehow submitted anyway (or if a future caller invoked the
resolve logic directly). Legacy re-fetches its own submitted `parcelid` and only relies on the
server check for correctness, so this mismatch only ever produces the wrong-looking button —
never an actually wrong write — but it is a genuine inconsistency, not a rounding artifact.

**Ported as-is**: the client hint in `ParcelCheckOnholdPage.tsx`
(`!parcel.store || !parcel.value || parseFloat(parcel.value) < 1 || !parcel.contents`) and the
server decision in `resolveOnholdCheck()` (`!parcel.store || parcel.value === null ||
Number(parcel.value) === 0 || !parcel.contents`) are two separate checks, not unified.

## Redirect target was already a dead link in legacy — redirected to the live equivalent instead

**Found:** when a scanned parcel has no `weight` recorded, legacy's JS redirects to
`/bema/parcels/parcels-online-add.cfm?trackingnum=...` — the **old** "Add Online Parcel"
variant. That file still exists on disk but its own nav link is commented out in
`views/layouts/lytBema.cfm` (`<!---<li>...parcels-online-add.cfm...--->`) in favor of
`parcels-online-add-2.cfm`, which is what this repo actually ported as
`routes.bema.parcelOnlineAdd()` (`docs/decisions/0022-parcels-online-add.md`). So in
production this redirect already lands on a stale, de-linked page — not a deliberate
distinction, just a spot legacy's own online-add upgrade never touched.

**Ported as the live equivalent, not a literal URL**: `ParcelCheckOnholdPage` redirects to
`routes.bema.parcelOnlineAdd()` with the same `?trackingnum=` query param. This is the first
caller of that param, so `ParcelOnlineAddPage` gained support for it: on mount, if
`?trackingnum=` is present, it's used as the tracking field's initial value and the same
lookup that Enter triggers runs automatically once — legacy's own `getParameterByName()` +
simulated keypress on load, reproduced the same way "Send SMS"'s url-prefilled lookup already
is.

## What wasn't ported, and why

- **The double `mquery` `UPDATE ... WHERE parcelid = ...` raw-SQL pattern** — reproduced as
  ordinary Prisma updates (`resolveOnholdCheck()`), not hand-written SQL; no trigger/check
  constraint is involved, so this is a plain case for the schema/migrations rule's default
  path.
- **`session.message` flash-and-redirect** — legacy's POST handler sets a session flash
  message and does a full-page redirect back to itself, which the browser then renders as a
  banner. This app's bema panel is CSR-only (`docs/migrations/03-target-architecture.md §3`),
  so the resolve API call's own response message is shown as a success `Alert` in place,
  with the tracking field cleared and refocused for the next scan — same net effect (an
  operator can immediately scan the next parcel), no server round-trip needed.

See `docs/findings.md` for the client-vs-server threshold mismatch and the dead-redirect-
target findings above.
