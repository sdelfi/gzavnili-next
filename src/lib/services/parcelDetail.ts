import type { Prisma } from '@/generated/prisma/client';
import { PHONE1, PHONE2, PHONE3 } from '@/lib/services/parcelQuery';

// The single-parcel projection the edit form loads. Separate from `ParcelListItem` on
// purpose: the list needs display-shaped data for ~10 dense columns, while the form needs
// exactly the fields it can write back, in the shape its inputs bind to (`date`/
// `datetime-local` strings, plain numbers, receiver and customer as nested objects).
// Trying to serve both from one type is what makes a form quietly start round-tripping
// fields it never showed.

export const PARCEL_DETAIL_INCLUDE = {
  user: {
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      organization: true,
      billingAddress: true,
    },
  },
  receiver: { select: { id: true, address: true } },
  parcelOffice: { select: { officeId: true } },
} satisfies Prisma.ParcelInclude;

type ParcelDetailRow = Prisma.ParcelGetPayload<{ include: typeof PARCEL_DETAIL_INCLUDE }>;

export type ParcelDetail = {
  id: string;
  trackingNum: string;
  trackingNum2: string;
  userId: string;
  /** Read-only display label for the chosen customer ("Last, First / username"). */
  userLabel: string;
  tripDate: string;
  service: string;
  awb: string;
  contents: string;
  store: string;

  weight: number | null;
  value: number | null;
  length: number | null;
  width: number | null;
  high: number | null;
  dimWeight: number | null;
  debt: number | null;

  location: string;
  groupId: string;
  notes: string;
  officeId: string;

  /** Trigger-maintained; the form shows them but never writes them. */
  status: string;
  isPaid: boolean;
  pcode: string;

  payMethod1: string;
  payAmount1: number | null;
  payMethod2: string;
  payAmount2: number | null;

  receiver: {
    receiverId: string | null;
    isGeCitizen: boolean;
    firstName: string;
    lastName: string;
    firstNameGe: string;
    lastNameGe: string;
    organization: string;
    country: string;
    street1: string;
    street2: string;
    city: string;
    state: string;
    postalCode: string;
    phone1: string;
    phone2: string;
    phone3: string;
  };

  customer: {
    firstName: string;
    lastName: string;
    organization: string;
    country: string;
    street1: string;
    street2: string;
    city: string;
    state: string;
    postalCode: string;
    phone1: string;
    phone2: string;
  };

  trackingReceived: string;
  trackingReceivedBy: string;
  trackingAway: string;
  trackingEstDelivery: string;
  trackingEstShip: string;
  trackingShipped: string;
  trackingDelay: string;
  trackingCustom: string;
  trackingProcessingCustom: string;
  trackingOffice: string;
  trackingSendRegion: string;
  trackingOutDelivery: string;
  trackingDeliveredSigned: string;
  trackingDeliveredSignedBy: string;
};

const text = (value: string | null | undefined) => value ?? '';
const num = (value: Prisma.Decimal | null) => (value === null ? null : Number(value));

/** `<input type="date">` wants `YYYY-MM-DD`. */
const dateInput = (value: Date | null) => (value === null ? '' : value.toISOString().slice(0, 10));

/** `<input type="datetime-local">` wants `YYYY-MM-DDTHH:mm` with no zone — the value is read
 *  back as UTC on save, matching how every other date on these screens is handled. */
const dateTimeInput = (value: Date | null) => (value === null ? '' : value.toISOString().slice(0, 16));

export function toParcelDetail(row: ParcelDetailRow): ParcelDetail {
  const address = row.receiver?.address ?? null;
  const billing = row.user.billingAddress ?? null;

  return {
    id: row.id,
    trackingNum: text(row.trackingNum),
    trackingNum2: text(row.trackingNum2),
    userId: row.userId,
    userLabel: `${text(row.user.lastName)}, ${text(row.user.firstName)} / ${row.user.username}`,
    tripDate: dateInput(row.tripDate),
    service: text(row.service),
    awb: text(row.awb),
    contents: text(row.contents),
    store: text(row.store),

    weight: num(row.weight),
    value: num(row.value),
    length: num(row.length),
    width: num(row.width),
    high: num(row.high),
    dimWeight: num(row.dimWeight),
    debt: num(row.debt),

    location: text(row.location),
    groupId: text(row.groupId),
    notes: text(row.notes),
    officeId: row.parcelOffice?.officeId ?? '',

    status: row.status,
    isPaid: row.isPaid,
    pcode: text(row.pcode),

    payMethod1: text(row.payMethod1),
    payAmount1: num(row.payAmount1),
    payMethod2: text(row.payMethod2),
    payAmount2: num(row.payAmount2),

    receiver: {
      receiverId: row.receiver?.id ?? null,
      // Legacy stores this on the receiver row (`receivers.isgecitizen`); this schema doesn't
      // carry that column, so it's derived from whether a Georgian-script name is on file —
      // which is the only thing the flag actually controls (which name pair is required).
      isGeCitizen: Boolean(address?.firstNameGe || address?.lastNameGe),
      firstName: text(address?.firstName),
      lastName: text(address?.lastName),
      firstNameGe: text(address?.firstNameGe),
      lastNameGe: text(address?.lastNameGe),
      organization: text(address?.organization),
      country: text(address?.country),
      street1: text(address?.street1),
      street2: text(address?.street2),
      city: text(address?.city),
      state: text(address?.state),
      postalCode: text(address?.postalCode),
      phone1: text(address?.[PHONE1]),
      phone2: text(address?.[PHONE2]),
      phone3: text(address?.[PHONE3]),
    },

    customer: {
      firstName: text(row.user.firstName),
      lastName: text(row.user.lastName),
      organization: text(row.user.organization ?? billing?.organization),
      country: text(billing?.country),
      street1: text(billing?.street1),
      street2: text(billing?.street2),
      city: text(billing?.city),
      state: text(billing?.state),
      postalCode: text(billing?.postalCode),
      phone1: text(billing?.[PHONE1]),
      phone2: text(billing?.[PHONE2]),
    },

    trackingReceived: dateInput(row.trackingReceived),
    trackingReceivedBy: text(row.trackingReceivedBy),
    trackingAway: dateInput(row.trackingAway),
    trackingEstDelivery: dateInput(row.trackingEstDelivery),
    trackingEstShip: dateInput(row.trackingEstShip),
    trackingShipped: dateInput(row.trackingShipped),
    trackingDelay: dateInput(row.trackingDelay),
    trackingCustom: dateInput(row.trackingCustom),
    // The five milestones operators time to the minute — same set the list screen renders
    // with a time and the bulk toolbar offers a datetime picker for.
    trackingProcessingCustom: dateTimeInput(row.trackingProcessingCustom),
    trackingOffice: dateTimeInput(row.trackingOffice),
    trackingSendRegion: dateTimeInput(row.trackingSendRegion),
    trackingOutDelivery: dateTimeInput(row.trackingOutDelivery),
    trackingDeliveredSigned: dateTimeInput(row.trackingDeliveredSigned),
    trackingDeliveredSignedBy: text(row.trackingDeliveredSignedBy),
  };
}
