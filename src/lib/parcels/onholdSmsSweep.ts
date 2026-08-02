import { db } from '@/lib/db';
import { formatPhone, sendSms } from '@/lib/services/smsGateway';
import { dedupeSmsBatch } from '@/lib/services/smsBatch';

// Ports `cron/sendOnholdSMS.cfm` — a one-time "please declare your on-hold parcel" SMS, gated
// by `Parcel.bSentOnHold` (docs/decisions/0027-cron-notifications.md). Distinct from, and not
// superseded by, `notificationEngine.ts` — this job never touches the `operations` table at
// all, and has its own fixed message text (not looked up from `templates_sms.cfm`).

const MESSAGE_GE =
  'სასწრაფოდ დაადეკლარირეთ თქვენი ამანათი Gzavnili.com-ზე, წინააღმდეგ შემთხვევაში ამანათი არ გამოიგზავნება.';
const MESSAGE_US = 'Your parcel were hold in USA office, because of missing info. Please log in in your account for further actions.';

// Legacy's own local status derivation for this one query (`sendOnholdSMS.cfm`'s inline
// `CASE`) — deliberately *not* this schema's shared `Parcel.status` column, which factors in
// `bOnHold`/`bNotOnHold` and would read "on_hold" for every row this job's WHERE clause
// selects. This mirrors the tracking-milestone-only precedence legacy computes inline, used
// only to decide whether a parcel has already progressed past "shipped"/"delivered" (in which
// case it's skipped from messaging, but still marked handled).
export function computeLocalStatus(parcel: {
  trackingDeliveredSigned: Date | null;
  trackingOutDelivery: Date | null;
  trackingOffice: Date | null;
  trackingCustom: Date | null;
  trackingDelay: Date | null;
  trackingShipped: Date | null;
  trackingReceived: Date | null;
  trackingAway: Date | null;
}): string {
  if (parcel.trackingDeliveredSigned) return 'delivered';
  if (parcel.trackingOutDelivery) return 'outdelivery';
  if (parcel.trackingOffice) return 'office';
  if (parcel.trackingCustom) return 'custom';
  if (parcel.trackingDelay) return 'delay';
  if (parcel.trackingShipped) return 'shipped';
  if (parcel.trackingReceived) return 'received';
  if (parcel.trackingAway) return 'awaiting';
  return 'New';
}

export async function runOnholdSmsSweep(): Promise<string> {
  const parcels = await db.parcel.findMany({
    where: { bOnHold: true, bNotOnHold: false, bSentOnHold: false },
    include: { user: { include: { billingAddress: true } } },
    orderBy: { userId: 'asc' },
  });

  const geSmsPhones: string[] = [];
  const usSmsQueue: { phone: string; text: string }[] = [];
  const usGeSmsQueue: { phone: string; text: string }[] = [];
  const parcelIds: string[] = [];
  let messagedCount = 0;

  for (const parcel of parcels) {
    parcelIds.push(parcel.id);
    const status = computeLocalStatus(parcel);
    if (status === 'shipped' || status === 'delivered') continue;

    const address = parcel.user.billingAddress;
    const phone = address?.cellPhone ?? '';
    const country = address?.country;

    let addToDb = false;
    let message = '';
    let formatted: string | 0 = 0;

    if (country === 'GE') {
      formatted = formatPhone(phone, 'GE');
      if (formatted !== 0) {
        addToDb = true;
        message = MESSAGE_GE;
        geSmsPhones.push(formatted);
      }
    } else if (country === 'US') {
      formatted = formatPhone(phone, 'US');
      if (formatted !== 0) {
        addToDb = true;
        message = parcel.user.language === 'ge' ? MESSAGE_GE : MESSAGE_US;
        if (parcel.user.language === 'ge') {
          usGeSmsQueue.push({ phone: formatted, text: message });
        } else {
          usSmsQueue.push({ phone: formatted, text: message });
        }
      }
    }

    if (addToDb) {
      messagedCount++;
      await db.message.create({
        data: {
          userId: parcel.userId,
          parcelId: parcel.id,
          senderId: null,
          smsBody: message,
          isSms: true,
          smsTo: formatted as string,
        },
      });
    }
  }

  try {
    if (geSmsPhones.length) {
      // Legacy dedupes only the *phones* here (`ListRemoveduplicates`), then sends them all
      // one gateway call using `GeSmsMessages[1]` — safe because `MESSAGE_GE` is the only
      // text this branch ever produces, so "the first message" is always the same string.
      const uniquePhones = [...new Set(geSmsPhones)].join(',');
      await sendSms(uniquePhones, MESSAGE_GE, 'GE');
    }
    for (const group of dedupeSmsBatch(usSmsQueue)) {
      await sendSms(group.phones, group.text, 'US');
    }
    for (const group of dedupeSmsBatch(usGeSmsQueue)) {
      // Still the US gateway — a Georgian-language text routed to a US-formatted number,
      // matching legacy's own `sendsms(type="US", ...)` call for this queue.
      await sendSms(group.phones, group.text, 'US');
    }
  } finally {
    // Legacy runs this exact UPDATE both on success and inside its `cfcatch` — reproduced via
    // `finally` so a gateway failure still marks every considered parcel as handled.
    if (parcelIds.length) {
      await db.parcel.updateMany({ where: { id: { in: parcelIds } }, data: { bSentOnHold: true } });
    }
  }

  return `considered ${parcelIds.length} on-hold parcel(s), messaged ${messagedCount}`;
}
