import { db } from '@/lib/db';
import { runParcelOperation } from '@/lib/services/parcelOperations';
import { orNull, upsertCustomer, upsertReceiver } from '@/lib/services/parcelShared';
import { diffEntry, recordParcelHistory, type ActingUser, type ParcelHistoryEntry } from '@/lib/services/parcelHistory';
import type { UpdateParcelInput } from '@/lib/validation/parcelSchema';

// Saving the parcel edit form, ported from `bema/parcels/parcels-update.cfm`'s POST branch.
//
// The legacy save touches five things in sequence, with no transaction around any of it: the
// parcel, its receiver (creating one if the form said "< New Receiver >"), the sender's own
// name and billing address, the parcel's delivery-office assignment, and finally a
// `paid`/`unpaid` operation. All five happen here too — inside one transaction, so a save
// that fails halfway can't leave a parcel pointing at a receiver that was never finished, or
// a customer renamed for a parcel that didn't save. The paid/unpaid operation stays *outside*
// it, deliberately: it raises invoices and payments of its own and is the same call the list
// screen's bulk toolbar makes, so it keeps its own transaction semantics.

/** `date`/`datetime-local` input value → instant. Bare dates land at UTC midnight, matching
 *  how the list screen's date filters read them back. */
function toDate(value: string): Date | null {
  const text = value.trim();
  if (!text) return null;

  let iso = text;
  if (!/([Zz]|[+-]\d{2}:\d{2})$/.test(iso)) {
    if (!iso.includes('T'))
      iso = `${iso}T00:00:00`; // `2026-07-20` → UTC midnight
    else if (iso.length === 16) iso = `${iso}:00`; // `2026-07-20T14:30` → add seconds
    iso = `${iso}Z`;
  }
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export type ParcelSaveResult = { id: string; receiverId: string | null };

export async function saveParcel(
  parcelId: string,
  input: UpdateParcelInput,
  /** The BEMA operator saving the form — stamped on the edit-log rows below. */
  acting: ActingUser | null = null,
): Promise<ParcelSaveResult> {
  // Read the pre-save values the edit log diffs against. Legacy carried these into the POST
  // as hidden `t*` form fields (`form.tstore`/`tcontents`/`tvalue`/`tdebt`/`tstatus`) and
  // trusted whatever the browser sent back; reading them from the row instead can't be
  // spoofed and can't go stale between render and submit.
  const before = await db.parcel.findUnique({
    where: { id: parcelId },
    select: { store: true, contents: true, value: true, debt: true, status: true },
  });

  const receiverId = await db.$transaction(async (tx) => {
    // --- Receiver ---------------------------------------------------------------------
    const nextReceiverId = await upsertReceiver(tx, input.userId, input.receiver);

    // --- Sender (customer) ------------------------------------------------------------
    // Legacy updates the customer's name and their *billing* address from this form on every
    // parcel save. Kept, including the surprising part: editing a parcel edits the customer.
    await upsertCustomer(tx, input.userId, input.customer);

    // --- Parcel -----------------------------------------------------------------------
    // Tracking numbers are upper-cased on save, same as legacy — operators type them in
    // whatever case the carrier's label used, and the list searches them as stored.
    await tx.parcel.update({
      where: { id: parcelId },
      data: {
        trackingNum: input.trackingNum.toUpperCase(),
        trackingNum2: orNull(input.trackingNum2.toUpperCase()),
        userId: input.userId,
        receiverId: nextReceiverId,
        tripDate: toDate(input.tripDate),
        service: orNull(input.service),
        awb: orNull(input.awb),
        contents: orNull(input.contents),
        store: orNull(input.store),

        weight: input.weight,
        value: input.value,
        length: input.length,
        width: input.width,
        high: input.high,
        dimWeight: input.dimWeight,
        debt: input.debt,

        location: orNull(input.location),
        groupId: orNull(input.groupId),
        notes: orNull(input.notes),

        // Legacy resets `topFlag` on every save — a pinned parcel stops being pinned once
        // someone edits it.
        topFlag: false,

        payMethod2: orNull(input.payMethod2),
        payAmount2: input.payAmount2,

        trackingReceived: toDate(input.trackingReceived),
        trackingReceivedBy: orNull(input.trackingReceivedBy),
        trackingAway: toDate(input.trackingAway),
        trackingEstDelivery: toDate(input.trackingEstDelivery),
        trackingEstShip: toDate(input.trackingEstShip),
        trackingShipped: toDate(input.trackingShipped),
        trackingDelay: toDate(input.trackingDelay),
        trackingCustom: toDate(input.trackingCustom),
        trackingProcessingCustom: toDate(input.trackingProcessingCustom),
        trackingOffice: toDate(input.trackingOffice),
        trackingSendRegion: toDate(input.trackingSendRegion),
        trackingOutDelivery: toDate(input.trackingOutDelivery),
        trackingDeliveredSigned: toDate(input.trackingDeliveredSigned),
        trackingDeliveredSignedBy: orNull(input.trackingDeliveredSignedBy),
      },
    });

    // --- Delivery office --------------------------------------------------------------
    // One assignment per parcel (`ParcelOffice` is unique on `parcelId`); an empty selection
    // clears it. `parcels.office_name` follows by trigger.
    await tx.parcelOffice.deleteMany({ where: { parcelId } });
    if (input.officeId) {
      await tx.parcelOffice.create({ data: { parcelId, officeId: input.officeId } });
    }

    // --- Edit log ---------------------------------------------------------------------
    // Legacy writes one `ParcelHistory` row per changed field, and only for these four —
    // tracking number, service, weight, dates and the rest are edited without leaving a
    // trace. Ported as-is (the reports' History tab shows exactly this set).
    if (before) {
      const editStatus = before.status;
      const entries = [
        diffEntry(parcelId, editStatus, 'Merchant', before.store ?? '', input.store),
        diffEntry(parcelId, editStatus, 'Content', before.contents ?? '', input.contents),
        diffEntry(parcelId, editStatus, 'Value', before.value?.toString() ?? '', String(input.value ?? '')),
        diffEntry(parcelId, editStatus, 'Debt', before.debt?.toString() ?? '', String(input.debt ?? '')),
      ].filter((entry): entry is ParcelHistoryEntry => entry !== null);

      // The "Partial Paid" row from `parcels-update.cfm`: written whenever this save records
      // a second payment amount, carrying method 2 / amount 2 as taken.
      if (input.payAmount2) {
        entries.push({
          parcelId,
          editStatus,
          valueName: 'Partial Paid',
          payMethod: input.payMethod2,
          payAmount: input.payAmount2,
        });
      }

      await recordParcelHistory(tx, acting, entries);
    }

    return nextReceiverId;
  });

  // --- Payment ------------------------------------------------------------------------
  // Outside the transaction above, and mutually exclusive: legacy checks `unpaynow` first,
  // and the form only ever offers whichever one applies to the parcel's current state.
  if (input.markUnpaid) {
    await runParcelOperation(
      { operation: 'unpaid', parcelIds: [parcelId], payMethod1: '', pCode: '', awb: '', buser: '' },
      acting,
    );
  } else if (input.markPaid) {
    await runParcelOperation(
      { operation: 'paid', parcelIds: [parcelId], payMethod1: input.payMethod1, pCode: '', awb: '', buser: '' },
      acting,
    );
  }

  return { id: parcelId, receiverId };
}

/** True when another parcel already carries this tracking number — the legacy
 *  `trackingNumExists(trackingNum, parcelId)` check, which the form also runs live as the
 *  operator types (`../ajax/trackingnum.cfm`). */
export async function trackingNumExists(trackingNum: string, excludeParcelId?: string): Promise<boolean> {
  const found = await db.parcel.findFirst({
    where: {
      trackingNum: trackingNum.trim().toUpperCase(),
      ...(excludeParcelId ? { id: { not: excludeParcelId } } : {}),
    },
    select: { id: true },
  });
  return found !== null;
}
