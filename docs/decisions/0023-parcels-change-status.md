# 0023 — "Change Parcel status"

## Scope

Ports `bema/parcels/parcels-change-status.cfm` + `views/parcels/vwParcelsChangeStatus.cfm` +
`bema/include/js/parcels-change-status.js` — a scan-driven bulk updater: pick a delivery
office, bema user, status, and/or location once, then scan several tracking numbers in a row,
each one getting the same settings applied. Gated `WEBSITE_ADMINISTRATOR,ADMINISTRATOR` →
`BemaAdministrator` only, same as the other recently-ported admin-only parcels screens.

Reuses the tracking-number lookup already built for "Add Online Parcel"
(`docs/decisions/0022-parcels-online-add.md`) — both screens call the same legacy ajax
endpoint (`bema/ajax/getParcel.cfm`), just with different query params
(`lookupParcelByTrackingNumber()` in `src/lib/services/parcelOnlineLookup.ts` was generalized
to take `cutLength`/`withTrackingNum2` options rather than duplicated). Unlike that screen,
this one does **not** gate on the found parcel's status at all — any match, any status,
proceeds.

## Three independent writes, not one combined update

Legacy's POST handler has three separate `if` blocks, each gated on its own field:

```
if (form.operation neq "") parcelDao.doOperation(operation=form.operation, parcelIds=form.parcelid, operationDate=Now())
if (form.officeid neq "" && val(form.officeid) gt 0) { ...set or clear the delivery office... }
if (form.iLocation neq "") { parcel.init(buser=form.buser, Location=form.iLocation); parcelDao.update(parcel) }
```

Reproduced as three independent conditional writes in `applyParcelStatusChange()`
(`src/lib/services/parcelChangeStatus.ts`), not a single combined "patch."

## The Bema User selection is silently discarded unless Location is also filled in

**Found:** `buser` is only ever written inside the *third* block, alongside `Location`, gated
on `iLocation neq ""` — not on `buser` itself. An operator who picks a Bema User and a Status
but leaves Location blank has their Bema User selection saved nowhere; the field resets to
whatever it showed (a sticky, session-remembered value) with no indication anything was
dropped.

**Ported as-is**: `applyParcelStatusChange()` only writes `buser` (and `location`) when
`iLocation` is non-blank, matching legacy's exact gating.

## `doOperation('paid')` with no payment method — real, reachable behavior here

This screen's Status dropdown includes "Paid", but the screen has no payment-method field at
all. Tracing `MSSQLParcelDAO.cfc`'s `doOperation('paid')` body (not just the call site) shows
`payMethod1`/`payAmount1` are only written when a method was actually supplied — the invoice/
payment/`bPaidDelivery=1` writes happen unconditionally either way. So picking "Paid" here
really does mark the parcel paid and raise an invoice for its full debt, just without ever
touching `payMethod1`/`payAmount1`. See `docs/findings.md` — this was a latent discrepancy in
the already-shipped `applyPaidOperation()` (which always overwrote both columns, since every
*previous* caller supplied a real method) surfaced by this screen being the first caller that
doesn't. Fixed in `parcelOperations.ts` to match legacy's own conditional SQL exactly.

## What wasn't ported, and why

- **The office select's magic `999`/`998` sentinels.** `999` ("Need delivery") is already a
  real seeded `DeliveryOffice` row (`scripts/seed-delivery-offices.ts`,
  `docs/decisions/0015-bema-parcels-list.md`) and needs no special-casing — it shows up in the
  office list like any other office. `998` ("Set empty") has no real-office equivalent and is
  kept as a UI-only sentinel (`CLEAR_OFFICE` in `parcelChangeStatusSchema.ts`) that clears the
  `ParcelOffice` assignment instead of writing a fake id.
- **`session.ilocation`/`session.officeid`/`session.operation`/`session.sbuser`** (the sticky
  cross-request defaults) are kept in `localStorage` instead of a real server session, same
  idiom as "Add Online Parcel"'s "Do not check tracking number" toggle — same practical effect
  (stays set until changed), different storage, since this app's bema sessions carry no
  arbitrary per-screen UI state.
- **The double ajax lookup** (legacy calls `getTrackingInfo()` once on Enter/click, then again
  inside the form's own `submit` handler right before the actual POST) is collapsed into one
  lookup call per Save — both calls are the same idempotent read with no behavioral
  difference; reproducing the redundancy would add nothing.
