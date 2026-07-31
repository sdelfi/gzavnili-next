import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { PHONE1, PHONE2, PHONE3 } from '@/lib/services/parcelQuery';
import { runParcelOperation } from '@/lib/services/parcelOperations';
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

/** Empty string means "not set" throughout this form; the DB wants NULL. */
const orNull = (value: string) => (value.trim() === '' ? null : value.trim());

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

export async function saveParcel(parcelId: string, input: UpdateParcelInput): Promise<ParcelSaveResult> {
  const receiverId = await db.$transaction(async (tx) => {
    // --- Receiver ---------------------------------------------------------------------
    // The address is written either way; only a brand-new receiver also needs the join row.
    const addressData: Prisma.AddressUncheckedCreateInput = {
      firstName: orNull(input.receiver.firstName),
      lastName: orNull(input.receiver.lastName),
      firstNameGe: orNull(input.receiver.firstNameGe),
      lastNameGe: orNull(input.receiver.lastNameGe),
      organization: orNull(input.receiver.organization),
      country: orNull(input.receiver.country),
      street1: orNull(input.receiver.street1),
      street2: orNull(input.receiver.street2),
      city: orNull(input.receiver.city),
      state: orNull(input.receiver.state),
      postalCode: orNull(input.receiver.postalCode),
      [PHONE1]: orNull(input.receiver.phone1),
      [PHONE2]: orNull(input.receiver.phone2),
      [PHONE3]: orNull(input.receiver.phone3),
    };

    let nextReceiverId = input.receiver.receiverId ?? null;
    if (nextReceiverId) {
      const existing = await tx.receiver.findUnique({ where: { id: nextReceiverId }, select: { addressId: true } });
      if (existing) {
        await tx.address.update({ where: { id: existing.addressId }, data: addressData });
      } else {
        // The receiver was deleted between loading the form and saving it — legacy would
        // have silently written an orphan. Fall through to creating a fresh one instead.
        nextReceiverId = null;
      }
    }
    if (!nextReceiverId) {
      const address = await tx.address.create({ data: addressData });
      const created = await tx.receiver.create({ data: { userId: input.userId, addressId: address.id } });
      nextReceiverId = created.id;
    }

    // --- Sender (customer) ------------------------------------------------------------
    // Legacy updates the customer's name and their *billing* address from this form on every
    // parcel save. Kept, including the surprising part: editing a parcel edits the customer.
    const customer = await tx.user.findUnique({ where: { id: input.userId }, select: { billingAddressId: true } });
    if (customer) {
      const customerAddress: Prisma.AddressUncheckedCreateInput = {
        firstName: orNull(input.customer.firstName),
        lastName: orNull(input.customer.lastName),
        organization: orNull(input.customer.organization),
        country: orNull(input.customer.country),
        street1: orNull(input.customer.street1),
        street2: orNull(input.customer.street2),
        city: orNull(input.customer.city),
        state: orNull(input.customer.state),
        postalCode: orNull(input.customer.postalCode),
        [PHONE1]: orNull(input.customer.phone1),
        [PHONE2]: orNull(input.customer.phone2),
      };
      const billingAddressId = customer.billingAddressId
        ? (await tx.address.update({ where: { id: customer.billingAddressId }, data: customerAddress })).id
        : (await tx.address.create({ data: customerAddress })).id;

      await tx.user.update({
        where: { id: input.userId },
        data: {
          firstName: orNull(input.customer.firstName),
          lastName: orNull(input.customer.lastName),
          billingAddressId,
        },
      });
    }

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

    return nextReceiverId;
  });

  // --- Payment ------------------------------------------------------------------------
  // Outside the transaction above, and mutually exclusive: legacy checks `unpaynow` first,
  // and the form only ever offers whichever one applies to the parcel's current state.
  if (input.markUnpaid) {
    await runParcelOperation({
      operation: 'unpaid',
      parcelIds: [parcelId],
      payMethod1: '',
      pCode: '',
      awb: '',
      buser: '',
    });
  } else if (input.markPaid) {
    await runParcelOperation({
      operation: 'paid',
      parcelIds: [parcelId],
      payMethod1: input.payMethod1,
      pCode: '',
      awb: '',
      buser: '',
    });
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
