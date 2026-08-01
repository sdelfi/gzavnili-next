import { db } from '@/lib/db';
import { PHONE1 } from '@/lib/services/parcelQuery';

// "Add Online Parcel"'s tracking-number lookup — ported from `bema/ajax/getParcel.cfm`
// (`?cut=1&withtrackingnum2=1&trackingnum=...`, the only way the page ever calls it). See
// docs/decisions/0022-parcels-online-add.md.
//
// Legacy runs two queries in sequence, the second only when the first finds nothing:
//  1. `RIGHT(TrackingNum, 11) = RIGHT(input, 11)` OR `TrackingNum2 = input`.
//  2. `TrackingNum LIKE '%' + RIGHT(input, 12) + '%'` OR `TrackingNum2 = input` — note the
//     *fallback* cuts to the last **12** characters, not 11; a genuine off-by-one between the
//     two queries, reproduced here rather than unified.
// Both exclude `TrackingNum LIKE 'dr-%'` (Delivery Request placeholder rows).
//
// `RIGHT(x, n) = RIGHT(y, n)` is reproduced as `endsWith` against the *input's* last-n
// characters (the input is a literal, not a column, so this is exact for any real tracking
// number — every one in this system is well over 11 characters; it only diverges from the
// literal SQL for an input shorter than 11 characters, which no real tracking number is).
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
  longName: string;
  receiverFirstName: string;
  receiverLastName: string;
  parcelName: string | null;
  value: string | null;
  contents: string | null;
  length: string | null;
  width: string | null;
  high: string | null;
  weight: string | null;
  dimWeight: string | null;
  debt: string | null;
  notes: string | null;
  bNotify: boolean;
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

export async function lookupParcelByTrackingNumber(trackingNumberRaw: string): Promise<OnlineParcelLookup | null> {
  const trackingNumber = trackingNumberRaw.trim();
  if (!trackingNumber) return null;

  const last11 = trackingNumber.slice(-11);
  const last12 = trackingNumber.slice(-12);

  let parcel = await db.parcel.findFirst({
    where: {
      trackingNum: NOT_DR,
      OR: [{ trackingNum: { endsWith: last11 } }, { trackingNum2: trackingNumber }],
    },
    include,
    orderBy: { created: 'desc' },
  });

  if (!parcel) {
    parcel = await db.parcel.findFirst({
      where: {
        trackingNum: NOT_DR,
        OR: [{ trackingNum: { contains: last12 } }, { trackingNum2: trackingNumber }],
      },
      include,
      orderBy: { created: 'desc' },
    });
  }

  if (!parcel) return null;

  const billingPhone1 = parcel.user.billingAddress?.[PHONE1] ?? '';
  const longName = `${parcel.user.lastName ?? ''}, ${parcel.user.firstName ?? ''} / ${parcel.user.username} / ${billingPhone1}`;

  return {
    parcelId: parcel.id,
    trackingNum: parcel.trackingNum ?? '',
    trackingNum2: parcel.trackingNum2 ?? '',
    status: parcel.status,
    service: parcel.service,
    userId: parcel.userId,
    longName,
    receiverFirstName: parcel.receiver?.address.firstName ?? '',
    receiverLastName: parcel.receiver?.address.lastName ?? '',
    parcelName: parcel.parcelName,
    value: parcel.value?.toString() ?? null,
    contents: parcel.contents,
    length: parcel.length?.toString() ?? null,
    width: parcel.width?.toString() ?? null,
    high: parcel.high?.toString() ?? null,
    weight: parcel.weight?.toString() ?? null,
    dimWeight: parcel.dimWeight?.toString() ?? null,
    debt: parcel.debt?.toString() ?? null,
    notes: parcel.notes,
    bNotify: parcel.bNotify,
  };
}
