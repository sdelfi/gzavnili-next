import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { PHONE1 } from '@/lib/services/parcelQuery';

// The tracking-number lookup shared by "Add Online Parcel", "Change Parcel status", and
// "Send SMS" — ported from `bema/ajax/getParcel.cfm`. All three screens call it with
// different query params, reproduced here as options rather than three copies of the same
// function:
//  - Add Online Parcel: `?cut=1&withtrackingnum2=1&trackingnum=...` (the `cutlength` param is
//    never passed, so legacy's own default of 11 applies) — see
//    docs/decisions/0022-parcels-online-add.md.
//  - Change Parcel status: `?cut=1&cutlength=12&trackingnum=...` — a 12-character primary cut,
//    and `withtrackingnum2` never passed (legacy default `0`, so `TrackingNum2` isn't matched
//    at all) — see docs/decisions/0023-parcels-change-status.md.
//  - Send SMS: `?cut=0&trackingnum=...` — an *exact* `TrackingNum` match, no right-cut/fuzzy
//    fallback at all (`cut: 'exact'` here). Legacy's own `cut=0` branch runs the identical
//    exact-equality query a second time as its "fallback" (the `cfif url.cut eq 0` condition
//    evaluates the same way in both query blocks), so there's no second distinct query to
//    reproduce — a single exact match is the whole of it. `withtrackingnum2` isn't passed
//    either (legacy default `0`) — see docs/decisions/0024-bema-send-sms.md.
//
// Legacy runs two queries in sequence for the `cut=1` (right-cut) mode, the second only when
// the first finds nothing:
//  1. `RIGHT(TrackingNum, cutlength) = RIGHT(input, cutlength)`, optionally OR
//     `TrackingNum2 = input`.
//  2. `TrackingNum LIKE '%' + RIGHT(input, 12) + '%'`, optionally OR `TrackingNum2 = input` —
//     the *fallback* always cuts to the last **12** characters, regardless of what `cutlength`
//     the primary query used; a genuine off-by-one whenever a caller passes a different
//     `cutlength` (as "Change Parcel status" does not, but as a generalization this function
//     now supports), reproduced rather than unified.
// Both exclude `TrackingNum LIKE 'dr-%'` (Delivery Request placeholder rows).
//
// `RIGHT(x, n) = RIGHT(y, n)` is reproduced as `endsWith` against the *input's* last-n
// characters (the input is a literal, not a column, so this is exact for any real tracking
// number — every one in this system is well over 11 characters; it only diverges from the
// literal SQL for an input shorter than the cut length, which no real tracking number is).
//
// Also not reproduced: the `status` this ajax endpoint computes with its own inline `CASE`
// (which checks `delivered` *before* the hold flags — the same non-standard ordering already
// flagged as an open question in `prisma/schema.prisma`'s `ParcelStatus` doc comment and
// `docs/migrations/07-risks-and-open-questions.md`). Reusing the trigger-maintained
// `Parcel.status` column instead keeps this endpoint consistent with every other screen in
// this app, rather than adding a third slightly-different one-off computation — see
// docs/findings.md.
export type OnlineParcelLookup = {
  parcelId: string;
  trackingNum: string;
  trackingNum2: string;
  status: string;
  service: string | null;
  userId: string;
  receiverId: string | null;
  longName: string;
  receiverFirstName: string;
  receiverLastName: string;
  parcelName: string | null;
  value: string | null;
  contents: string | null;
  store: string | null;
  length: string | null;
  width: string | null;
  high: string | null;
  weight: string | null;
  dimWeight: string | null;
  debt: string | null;
  notes: string | null;
  bNotify: boolean;
  // "Send message" (docs/decisions/0033-bema-send-message.md) needs these three for its
  // senddate/deliverydate/servicetransit hidden fields — `bema/ajax/getParcel.cfm`'s
  // TRIPDATE/TRACKINGESTSHIP/TRACKINGESTDELIVERY, not previously exposed here since no
  // earlier caller needed them.
  tripDate: string | null;
  trackingEstShip: string | null;
  trackingEstDelivery: string | null;
};

// Tracking numbers are always stored upper-cased on save (matching every other write path in
// this app), so a plain case-sensitive `startsWith` is sufficient here.
const NOT_DR = { not: { startsWith: 'DR-' } };

const include = {
  user: {
    select: { username: true, firstName: true, lastName: true, billingAddress: { select: { [PHONE1]: true } } },
  },
  receiver: { select: { address: { select: { firstName: true, lastName: true } } } },
} as const;

type ParcelWithIncludes = Prisma.ParcelGetPayload<{ include: typeof include }>;

function toLookupResult(parcel: ParcelWithIncludes): OnlineParcelLookup {
  const billingPhone1 = parcel.user.billingAddress?.[PHONE1] ?? '';
  const longName = `${parcel.user.lastName ?? ''}, ${parcel.user.firstName ?? ''} / ${parcel.user.username} / ${billingPhone1}`;

  return {
    parcelId: parcel.id,
    trackingNum: parcel.trackingNum ?? '',
    trackingNum2: parcel.trackingNum2 ?? '',
    status: parcel.status,
    service: parcel.service,
    userId: parcel.userId,
    receiverId: parcel.receiverId,
    longName,
    receiverFirstName: parcel.receiver?.address.firstName ?? '',
    receiverLastName: parcel.receiver?.address.lastName ?? '',
    parcelName: parcel.parcelName,
    value: parcel.value?.toString() ?? null,
    contents: parcel.contents,
    store: parcel.store,
    length: parcel.length?.toString() ?? null,
    width: parcel.width?.toString() ?? null,
    high: parcel.high?.toString() ?? null,
    weight: parcel.weight?.toString() ?? null,
    dimWeight: parcel.dimWeight?.toString() ?? null,
    debt: parcel.debt?.toString() ?? null,
    notes: parcel.notes,
    bNotify: parcel.bNotify,
    tripDate: parcel.tripDate?.toISOString() ?? null,
    trackingEstShip: parcel.trackingEstShip?.toISOString() ?? null,
    trackingEstDelivery: parcel.trackingEstDelivery?.toISOString() ?? null,
  };
}

export async function lookupParcelByTrackingNumber(
  trackingNumberRaw: string,
  options: { cutLength?: number; withTrackingNum2?: boolean; cut?: 'right' | 'exact' } = {},
): Promise<OnlineParcelLookup | null> {
  const trackingNumber = trackingNumberRaw.trim();
  if (!trackingNumber) return null;

  const withTrackingNum2 = options.withTrackingNum2 ?? true;

  if (options.cut === 'exact') {
    const parcel = await db.parcel.findFirst({
      where: {
        trackingNum: NOT_DR,
        OR: [{ trackingNum: trackingNumber }, ...(withTrackingNum2 ? [{ trackingNum2: trackingNumber }] : [])],
      },
      include,
      orderBy: { created: 'desc' },
    });
    return parcel ? toLookupResult(parcel) : null;
  }

  const cutLength = options.cutLength ?? 11;
  const lastCut = trackingNumber.slice(-cutLength);
  const last12 = trackingNumber.slice(-12);

  let parcel = await db.parcel.findFirst({
    where: {
      trackingNum: NOT_DR,
      OR: [{ trackingNum: { endsWith: lastCut } }, ...(withTrackingNum2 ? [{ trackingNum2: trackingNumber }] : [])],
    },
    include,
    orderBy: { created: 'desc' },
  });

  if (!parcel) {
    parcel = await db.parcel.findFirst({
      where: {
        trackingNum: NOT_DR,
        OR: [{ trackingNum: { contains: last12 } }, ...(withTrackingNum2 ? [{ trackingNum2: trackingNumber }] : [])],
      },
      include,
      orderBy: { created: 'desc' },
    });
  }

  return parcel ? toLookupResult(parcel) : null;
}
