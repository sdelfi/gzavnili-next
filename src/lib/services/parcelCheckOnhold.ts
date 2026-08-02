import { db } from '@/lib/db';

// bema "Check on hold" (`bema/parcels/parcels-check-onhold.cfm`) — see
// docs/decisions/0028-parcels-check-onhold.md. Staff scans an on-hold parcel's tracking
// number; this is the server-side decision its POST handler makes once it has the parcel:
// if store/value/contents are still missing, the parcel stays on hold but its "already
// reminded" flag is reset so the on-hold SMS sweep (`onholdSmsSweep.ts`) will nudge the
// customer again; otherwise both hold flags are cleared, same as the parcels-list "Remove
// from On Hold" action (`clear-hold` route) — but this decision is made here, not trusted
// from the client, exactly as legacy re-reads the parcel server-side rather than trusting
// its own submitted form fields.
//
// Legacy's own condition: `parcel.getStore() eq '' or parcel.getValue() eq 0 or
// parcel.getValue() eq '' or parcel.getContents() eq ''`. Note this is *not* the same
// threshold the page's own client-side JS uses to decide which button to show
// (`data.VALUE < 1`, not `== 0`) — a real legacy inconsistency (a value of e.g. 0.5 shows
// the "still on hold" button client-side, but this server check would resolve it as
// "remove from on hold"), reproduced as two genuinely different checks rather than unified.
// See docs/findings.md.
export type CheckOnholdResult = { message: string };

export async function resolveOnholdCheck(parcelId: string): Promise<CheckOnholdResult | null> {
  const parcel = await db.parcel.findUnique({
    where: { id: parcelId },
    select: { store: true, value: true, contents: true },
  });
  if (!parcel) return null;

  const stillMissing = !parcel.store || parcel.value === null || Number(parcel.value) === 0 || !parcel.contents;

  if (stillMissing) {
    await db.parcel.update({ where: { id: parcelId }, data: { bSentOnHold: false } });
    return { message: 'Parcel has been successfully still onhold.' };
  }

  await db.parcel.update({ where: { id: parcelId }, data: { bOnHold: false, bNotOnHold: false } });
  return { message: 'Parcel has been successfully removed from onhold.' };
}
