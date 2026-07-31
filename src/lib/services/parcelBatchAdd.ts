import { db } from '@/lib/db';
import { computeDraftParcelTotals, finalDebt, priceOverrideScale } from '@/lib/parcels/batchPricing';
import type { PricingRule } from '@/lib/parcels/pricing';
import { runParcelOperation } from '@/lib/services/parcelOperations';
import { orNull, upsertCustomer, upsertReceiver } from '@/lib/services/parcelShared';
import type { AddParcelBatchInput } from '@/lib/validation/parcelBatchSchema';

// Saving the batch "Add Parcel" screen, ported from the POST branch of
// `bema/parcels/parcels-add.cfm`. One customer, several draft parcels (each its own
// receiver), created together. Two things legacy does that are deliberately not repeated
// here — both dead for the reason given:
//
// * The per-service trip-date/estimate lookup from `config` (`dtCargoShip`/`dtExpressShip`/
//   `dtRegularShip`). That belongs to the AWB operation (`applyAwbOperation` in
//   `parcelOperations.ts`) already, and this screen's own trip date field (if the operator
//   sets one at all — the modal doesn't have one; there's no `tripdate` input in
//   `views/parcels/vwParcelsAdd.cfm`'s add-parcel form) has no config-driven default to
//   port.
// * `form.store` always being `'Personal'` (`param name = "form.store" default =
//   "Personal"`, and the modal's own Store input is commented out in the view — nothing on
//   this screen ever sets it to anything else, including the `'Presonal'`-typo fallback
//   later in the same file, which no path here can reach either). Hardcoded rather than
//   re-implementing a toggle no control on this screen can trigger.
//
// The agent tracking-number prefix (`agent-prefix-map.cfm`, three hardcoded legacy MSSQL
// GUIDs → `CH`/`MR`) is not ported: those ids are legacy `BemaUser` primary keys that don't
// exist in this schema (ids here are freshly generated on create), so the mapping has
// nothing to match against post-migration. Flagged in docs/decisions/0017, not silently
// dropped.
//
// --- The payment split: traced into the DAO, and it's dead code ---------------------------
//
// `parcels-add.cfm` computes a `payAmount1`/`payAmount2` split of the two payment-method
// amounts, proportional to each parcel's share of the batch total, and passes `payAmount1`
// into `parcelDao.doOperation('paid', payAmount1 = form.payAmount1)`. It looks like it
// should matter. Read all the way into `MSSQLParcelDAO.cfc`'s actual `doOperation('paid')`
// implementation, and it doesn't: that function ignores the `payAmount1` argument entirely
// and computes its own amount from the *parcel row already in the database* —
// `resAmount = parcel.getDebt()`, minus `parcel.getPayAmount2()` only if that column is
// already non-zero. And `payMethod2`/`payAmount2` are never included in this screen's own
// `parcel.init(...)` call before `parcelDao.create(parcel)` — so for a parcel created here,
// that column is always empty, `resAmount` is always the parcel's full (already
// group-fee/Price-Total-scaled) `debt`, and the split computed a few lines earlier changes
// nothing about what gets invoiced. Confirmed by reading the same DAO's `unpaid`/`paid`
// branches and the shared `applyPaidOperation` this project already ported for the edit
// screen (`parcelOperations.ts`) — it's the same "full debt, minus payAmount2 if set" rule,
// verified against the DAO source, not just against the .cfm call site.
//
// So: every parcel gets invoiced/paid its full `debt` when payment method 1 isn't "Debt",
// full stop — reusing `runParcelOperation('paid', ...)` below, exactly like the edit screen
// does, rather than the proportional split this file used to compute. See
// docs/decisions/0017 for the "what to do about the now-provably-inert Payment method 2/
// Amount fields in the UI" question this raised, which is a product call, not a technical
// one, and hasn't been made yet.

export type DraftParcelResult = { trackingNum: string; parcelId: string };

export async function saveParcelBatch(input: AddParcelBatchInput): Promise<{ parcels: DraftParcelResult[] }> {
  const rules = await db.customerPricingRule.findMany({ where: { userId: input.userId } });
  const pricingRules: PricingRule[] = rules.map((r) => ({
    id: r.id,
    serviceType: r.serviceType,
    mode: r.mode,
    value: r.value.toString(),
    validFrom: r.validFrom.toISOString(),
    validTo: r.validTo?.toISOString() ?? null,
    notes: r.notes,
  }));

  const calcInputs = input.draftParcels.map((draft, index) => ({
    id: String(index),
    groupId: draft.groupId,
    delivery: draft.delivery,
    service: draft.service,
    weight: draft.weight,
  }));
  const { items } = computeDraftParcelTotals(calcInputs, pricingRules);
  const rawGrandTotal = items.reduce((sum, i) => sum + i.rawTotal, 0);
  const scale = priceOverrideScale(rawGrandTotal, input.priceTotal);

  // Selecting anything other than "Debt" for payment method 1 marks every parcel in the
  // batch paid, for its full (scaled) debt — legacy's `isPaid = (form.payMethod1 neq
  // "Debt")` gate, and `applyPaidOperation`'s own "full debt" rule (see the file header).
  const isPaid = input.paymentMethod1 !== 'Debt';

  const results = await db.$transaction(async (tx) => {
    // Legacy re-saves the customer's name/billing address on every parcel save here too,
    // redundant with the immediate "Save" on the customer box but harmless — same as the
    // single-parcel edit screen.
    await upsertCustomer(tx, input.userId, input.customer);

    const created: DraftParcelResult[] = [];
    for (let index = 0; index < input.draftParcels.length; index++) {
      const draft = input.draftParcels[index];
      const debt = finalDebt(items[index].rawTotal, scale);
      const receiverId = await upsertReceiver(tx, input.userId, draft.receiver);

      const parcel = await tx.parcel.create({
        data: {
          trackingNum: draft.trackingNum.trim().toUpperCase(),
          userId: input.userId,
          receiverId,
          service: draft.service,
          contents: orNull(draft.contents),
          store: 'Personal',
          weight: draft.weight,
          value: draft.value,
          debt,
          groupId: orNull(draft.groupId),
          notes: orNull(draft.notes),
          bNotify: draft.notify,
          trackingReceived: draft.trackingReceived ? new Date(draft.trackingReceived) : new Date(),
          trackingReceivedBy: orNull(draft.trackingReceivedBy),
        },
      });

      if (draft.officeId) {
        await tx.parcelOffice.create({ data: { parcelId: parcel.id, officeId: draft.officeId } });
      }

      created.push({ trackingNum: parcel.trackingNum ?? draft.trackingNum, parcelId: parcel.id });
    }

    return created;
  });

  if (isPaid) {
    await runParcelOperation({
      operation: 'paid',
      parcelIds: results.map((r) => r.parcelId),
      payMethod1: input.paymentMethod1,
      pCode: '',
      awb: '',
      buser: '',
    });
  }

  return { parcels: results };
}
