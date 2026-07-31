import { db } from '@/lib/db';
import { computeDraftParcelTotals, finalDebt, paymentSplit, priceOverrideScale } from '@/lib/parcels/batchPricing';
import type { PricingRule } from '@/lib/parcels/pricing';
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
// Payment is applied per parcel for exactly its own share of the two payment-method amounts
// (`batchPricing.ts`'s `paymentSplit`), not by reusing the edit screen's/list's
// `applyPaidOperation` (which invoices "whatever debt isn't already covered by a prior
// partial payment") — that would over-invoice here whenever the two amounts entered don't
// add up to the full batch total, since this screen's `payAmount2` column means "this
// parcel's method-2 share of *this* payment", not "an earlier partial payment to net off".

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
  // batch paid, regardless of how much of the total that method's amount actually covers —
  // literally what legacy's `isPaid = (form.payMethod1 neq "Debt")` gate does.
  const isPaid = input.paymentMethod1 !== 'Debt';

  const perParcel = input.draftParcels.map((draft, index) => {
    const calc = items[index];
    return {
      draft,
      debt: finalDebt(calc.rawTotal, scale),
      split: paymentSplit(calc.rawTotal, rawGrandTotal, input.paymentAmount1 ?? 0, input.paymentAmount2 ?? 0),
    };
  });

  const results = await db.$transaction(async (tx) => {
    // Legacy re-saves the customer's name/billing address on every parcel save here too,
    // redundant with the immediate "Save" on the customer box but harmless — same as the
    // single-parcel edit screen.
    await upsertCustomer(tx, input.userId, input.customer);

    const created: DraftParcelResult[] = [];
    for (const { draft, debt, split } of perParcel) {
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
          // This parcel's method-2 share of the batch payment — same columns the edit
          // screen's "Partial paid" field writes.
          payMethod2: split.payAmount2 > 0 ? input.paymentMethod2 : null,
          payAmount2: split.payAmount2 > 0 ? split.payAmount2 : null,
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
    for (let i = 0; i < results.length; i++) {
      const amount = perParcel[i].split.payAmount1;
      if (amount <= 0) continue;
      const parcelId = results[i].parcelId;
      const now = new Date();
      await db.$transaction(async (tx) => {
        await tx.invoice.create({
          data: { userId: input.userId, invoiceDate: now, items: { create: [{ parcelId, amount }] } },
        });
        await tx.payment.create({
          data: { userId: input.userId, paymentDate: now, amount, paymentMethodId: input.paymentMethod1 },
        });
        await tx.parcel.update({
          where: { id: parcelId },
          data: { bPaidDelivery: true, payMethod1: input.paymentMethod1, payAmount1: amount },
        });
      });
    }
  }

  return { parcels: results };
}
