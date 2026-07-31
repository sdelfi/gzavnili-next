# 0017 — Batch "Add Parcel": ported the group-fee calculation, deliberately simplified a few
# ajax-era mechanics that don't apply to a single-page React form

Legacy actually serves two different "add a parcel" screens from two different controllers:

- `bema/parcels/parcels-update.cfm?nrc=1` — the single-parcel add screen this project's first
  "Add Parcel" pass targeted. It shares its view/controller with the edit screen and produces
  exactly one parcel per submit.
- `bema/parcels/parcels-add.cfm` + `views/parcels/vwParcelsAdd.cfm` — the sidebar's "Add
  Parcel (new)" entry actually points here. One customer, a table of **several** draft
  parcels (each its own receiver), assembled client-side and created together in one submit,
  with a shared per-group delivery fee and a two-payment-method split across the whole batch.

This doc covers the second one, which is what got built this pass — the customer-requiredness
and store-auto-toggle fixes from the first pass turned out to be real, shared behaviour (both
screens need them) and were kept.

## The calculation, ported carefully (the client's explicit ask)

`src/lib/parcels/batchPricing.ts`, ported from `parcels-add.js`'s `sortParcelsTable()` and
`parcels-add.cfm`'s POST handler:

1. **Per-parcel base price** — unchanged, `calculateParcelPrice()` (customer pricing rules,
   then the default per-service schedule), same as the edit screen.
2. **Group delivery fee** — parcels share a `groupId`; a group's *first* parcel's delivery
   method decides a fee added once for the whole group: Pickup adds nothing, Delivery adds a
   flat $5, Region adds $5 per started 10kg of the group's total weight.
3. **$5 minimum charge per group** — compared against the group's *pre-fee* total, and
   additive with the delivery fee above rather than superseding it (a low-value Delivery group
   really is charged both the flat fee and the top-up — found in the source, preserved, not
   "fixed"; see `computeGroupIncrease()`'s doc comment).
4. The group's total fee/top-up is split **evenly** across its parcels (not weighted by
   weight or price).
5. **Price Total override** — an optional field; left blank or matching the calculated total
   is a no-op, anything else scales every parcel's price proportionally
   (`priceOverrideScale()`/`finalDebt()`).
6. **Two-payment-method split** — `paymentAmount1`/`paymentAmount2` (entered once, for the
   whole batch) are split across parcels proportionally to each parcel's *unscaled* share of
   the total (`paymentSplit()`) — legacy computes this from the pre-override amount, so a
   Price Total override changes what gets charged without changing how the two payment
   amounts are divided up. Preserved as found, not reconciled.

All of the above is pure, DB-free, and unit-tested (`batchPricing.test.ts`) — the group-fee
tiers, the minimum-charge stacking, the override scale, and the payment split.

## Payment application: a deliberate departure from `applyPaidOperation`

Selecting anything other than "Debt" for payment method 1 marks *every* parcel in the batch
paid, regardless of how much of the total that method's amount actually covers — literally
legacy's `isPaid = (form.payMethod1 neq "Debt")` gate.

The existing single-parcel `applyPaidOperation` (`parcelOperations.ts`, used by the edit
screen and the list's bulk toolbar) invoices "whatever debt isn't already covered by a prior
partial payment" — right for that screen, where `payAmount2` means "an earlier partial
payment, net it off." Reusing it here would have meant every parcel gets invoiced for its
*full* remaining debt the moment payment method 1 is anything but Debt, even if the amount
entered only covers a fraction of the batch total. `parcelBatchAdd.ts` instead invoices each
parcel for exactly its own computed share of `paymentAmount1` — a parcel with a zero share
(payment doesn't stretch that far) gets no invoice/payment record at all, not a full one.

## What's intentionally not ported, and why

- **The tmp-table tracking-number reservation** (`bema/ajax/tmpTracking.cfm`,
  `checkParcelTmpTable`). It exists so legacy's stateless multi-page flow could coordinate
  drafts across page loads/tabs. This screen keeps its drafts in React state until one
  submit, so there's nothing to reserve — the final submit's own tracking-number-uniqueness
  check (shared with the edit screen, `trackingNumExists`) is what actually has to hold, and
  it does, including within the batch itself.
- **The agent tracking-number prefix** (`agent-prefix-map.cfm`: three hardcoded legacy MSSQL
  `BemaUser` GUIDs → `CH`/`MR`). Those ids don't exist in this schema (every id here is freshly
  generated on create), so the mapping has nothing to match against post-migration. A real
  "agent prefix" field on `User` would be the honest fix; not built this pass.
- **The BEMA-agent flat-rate override** (`isAgent`/`agentPrice`, `parcels-add.js`'s
  `calculateDebtByService`). `User.agentPrice` was already simplified to a bare boolean flag
  in an earlier phase (no numeric per-kg rate stored) — this pass didn't re-open that.
- **`generateNewTracking()`'s ajax-backed uniqueness loop** for "Duplicate". The batch table's
  Duplicate button just reseeds the default time-based tracking core; the final submit's own
  duplicate check catches a real collision (a rare case for a manual duplicate click), rather
  than looping ajax calls to pre-empt one.
- **`form.store` always resolving to `'Personal'`** (including the `'Presonal'`-typo
  fallback later in the same file) — the modal's own Store input is commented out in
  `vwParcelsAdd.cfm`; nothing on this screen can ever set it to anything else. Hardcoded
  `'Personal'` in `parcelBatchAdd.ts` rather than reimplementing a toggle no control here can
  reach, and the typo isn't reproduced since no code path in this port needs a fallback at
  all.
- **Per-draft inline field errors on a schema-validation failure at final submit.** The batch
  payload's zod errors are dotted paths like `draftParcels.2.receiver.city`; this pass surfaces
  them as a flat message list at the top of the page rather than reopening the specific
  closed draft modal and pointing at the field. A real gap for a large batch with one bad
  draft buried in it — flagged here, not silently dropped.

## The customer box: a lighter create than the full "New Customer" screen

`bema/ajax/customerEdit.cfm` creates a walk-in customer with **no username or password
field on this screen at all** — an auto-generated `GZ<n>` username (the same generator
`registerCustomer()` uses) and no password hash whatsoever, exactly legacy's outcome (the
account can only ever be logged into after a "forgot password" reset). Reusing the full
`createUserSchema` wasn't an option — it requires both. `saveQuickCustomer()`
(`parcelBatchCustomer.ts`) reproduces the lighter create/update instead, gated by the
`ParcelAddCustomerSection`'s own "Save"/"Update" button — legacy's `checkBtns()` requires a
real customer id before a single parcel can be drafted, same here.

## Two Add-only decisions that don't extend back to the edit screen

- **"Save & Add Another" / "Save & Add Receiver" style flows are Add-only**, per legacy —
  the edit screen never grows a batch table.
- **The "Add Parcel" link that used to live on the parcels list itself is legacy-dead**
  (commented out) and stays that way; the sidebar entry is the only path in.
