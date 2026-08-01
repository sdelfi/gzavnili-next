import type { Prisma, ParcelStatus } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { PHONE1 } from '@/lib/services/parcelQuery';
import { formatPhone, type SmsCountry } from '@/lib/services/smsGateway';

// "Send Bulk SMS" (`bema/messages/sms_add_bulk.cfm`) — the parcel-filter + phone-resolution +
// queue-insert logic, plus the `sms_queue` CRUD `messages/queue.cfc` provides. See
// docs/decisions/0025-bema-send-bulk-sms.md.

// The dropdown's status options mapped to the ones the trigger-maintained `Parcel.status`
// column can actually produce. Reusing that column (rather than a fourth slightly-different
// inline CASE) is the same call already made for `getParcel.cfm` in
// `parcelOnlineLookup.ts` — see docs/findings.md for the one real divergence this introduces
// (`custom` no longer separately catches a `processing_custom` parcel). `"paid"` has no
// mapping at all: legacy's own inline CASE here never produces a `'paid'` status value (no
// branch computes it), so selecting it always yields zero candidates in legacy too — kept as a
// dropdown option for UI parity, resolved to "no matches" rather than an unfiltered list.
export const BULK_SMS_STATUS_FILTER: Record<string, ParcelStatus> = {
  OnHold: 'OnHold',
  NotOnHold: 'NotOnHold',
  office: 'Office',
  custom: 'Custom',
  outdelivery: 'OutDelivery',
  Delay: 'Delay',
  received: 'Received',
  awaiting: 'Awaiting',
  region: 'Region',
  shipped: 'Shipped',
};

const CANDIDATE_SELECT = {
  userId: true,
  receiverId: true,
  user: {
    select: {
      notifyViaSms: true,
      billingAddress: { select: { [PHONE1]: true, country: true } },
    },
  },
  receiver: {
    select: {
      address: { select: { [PHONE1]: true, country: true } },
    },
  },
} as const;

type BulkSmsCandidate = Prisma.ParcelGetPayload<{ select: typeof CANDIDATE_SELECT }>;

// Legacy's own query has no `TrackingNum NOT LIKE 'dr-%'` exclusion (unlike `getParcel.cfm`) —
// Delivery Request placeholder parcels are eligible candidates here too, reproduced as such.
export async function findBulkSmsCandidates(filters: {
  status?: string;
  country?: 'GE' | 'US' | '';
}): Promise<BulkSmsCandidate[]> {
  if (filters.status) {
    const mapped = BULK_SMS_STATUS_FILTER[filters.status];
    if (!mapped) return [];
    return db.parcel.findMany({
      where: {
        status: mapped,
        ...(filters.country ? { user: { billingAddress: { country: filters.country } } } : {}),
      },
      select: CANDIDATE_SELECT,
    });
  }
  return db.parcel.findMany({
    where: filters.country ? { user: { billingAddress: { country: filters.country } } } : {},
    select: CANDIDATE_SELECT,
  });
}

export type BulkSmsTarget = { phone: string; text: string; phoneType: SmsCountry };

// Legacy loops the candidate parcels once, checking "customer" then "receiver" per row (in
// that order), deduping against two arrays shared across *both* legs (`GeSmsNumbers`/
// `SmsNumbers`) — so a customer and a receiver who happen to share a phone number only ever
// get queued once, whichever leg reaches them first.
export function resolveBulkSmsTargets(
  candidates: BulkSmsCandidate[],
  sendTo: ('customer' | 'receiver')[],
  message: string,
): BulkSmsTarget[] {
  const geNumbers = new Set<string>();
  const usNumbers = new Set<string>();
  const data: BulkSmsTarget[] = [];

  const sendToCustomer = sendTo.includes('customer');
  const sendToReceiver = sendTo.includes('receiver');

  for (const candidate of candidates) {
    if (sendToCustomer && candidate.user.notifyViaSms) {
      const country = candidate.user.billingAddress?.country;
      const phone = candidate.user.billingAddress?.[PHONE1] ?? '';
      if (country === 'GE') {
        const formatted = formatPhone(phone, 'GE');
        if (formatted !== 0 && !geNumbers.has(formatted)) {
          data.push({ phone: formatted, text: message, phoneType: 'GE' });
          geNumbers.add(formatted);
        }
      } else if (country === 'US') {
        const formatted = formatPhone(phone, 'US');
        if (formatted !== 0 && !usNumbers.has(formatted)) {
          data.push({ phone: formatted, text: message, phoneType: 'US' });
          usNumbers.add(formatted);
        }
      }
    }

    if (sendToReceiver) {
      const country = candidate.receiver?.address.country;
      const phone = candidate.receiver?.address[PHONE1] ?? '';
      if (country === 'GE') {
        const formatted = formatPhone(phone, 'GE');
        if (formatted !== 0 && !geNumbers.has(formatted)) {
          // Legacy bug, reproduced: this branch pushes `type="US"` even though the number was
          // just formatted for GE — a copy-paste of the US branch below it that never got the
          // literal fixed up. `sendSms()`'s own `995`/`+995`-prefix re-derivation still routes
          // the eventual send to the GE gateway correctly; what's actually lost is the cron
          // drain's bulk GE grouping (this row is sent individually via the "US" branch
          // instead of joined with other GE sends sharing the same text). See
          // docs/findings.md.
          data.push({ phone: formatted, text: message, phoneType: 'US' });
          geNumbers.add(formatted);
        }
      } else if (country === 'US') {
        const formatted = formatPhone(phone, 'US');
        if (formatted !== 0 && !usNumbers.has(formatted)) {
          data.push({ phone: formatted, text: message, phoneType: 'US' });
          usNumbers.add(formatted);
        }
      }
    }
  }

  return data;
}

// `queue.cfc`'s `bulkInsert()` — an unconditional multi-row INSERT, no DB-level dedup. The
// count it returns should always equal `entries.length` (nothing in the schema, legacy's or
// this one, gives a row a reason to be silently skipped) — see docs/findings.md for why the
// caller still computes a "(N already in queue)" discrepancy message anyway, matching legacy.
export async function bulkInsertSmsQueue(entries: BulkSmsTarget[]): Promise<number> {
  if (!entries.length) return 0;
  const result = await db.smsQueueEntry.createMany({
    data: entries.map((e) => ({ phone: e.phone.trim(), text: e.text.trim(), phoneType: e.phoneType.trim() })),
  });
  return result.count;
}

export async function countSmsQueue(): Promise<number> {
  return db.smsQueueEntry.count();
}

export async function cleanSmsQueue(): Promise<number> {
  const result = await db.smsQueueEntry.deleteMany();
  return result.count;
}

async function getSmsQueue(limit: number, dir: 'asc' | 'desc') {
  if (limit <= 0) return [];
  return db.smsQueueEntry.findMany({
    orderBy: [{ createdAt: dir }, { id: dir }],
    take: limit,
  });
}

export type SmsQueuePreview = {
  count: number;
  queue: Awaited<ReturnType<typeof getSmsQueue>>;
  queueFirst: Awaited<ReturnType<typeof getSmsQueue>> | null;
};

// `sms_add_bulk.cfm`'s own preview logic: with more than 10 queued, show the oldest 5 and the
// newest 5 (each fetched as its own query, `queue`/`queueFirst`); 10 or fewer, show everything
// in one batch. The view then loops each batch from its *last* row back to its first —
// reproduced here by reversing after fetch, so the arrays returned are already in the exact
// order legacy's markup ends up displaying (oldest-5 newest-to-oldest, then, if present, a
// separator, then newest-5 oldest-to-newest) — an odd "converge toward each extreme" order
// that reads like an artifact of reusing the same reverse-loop for both batches, not a
// deliberate design; reproduced as-is regardless. See docs/decisions/0025-bema-send-bulk-sms.md.
export async function getSmsQueuePreview(): Promise<SmsQueuePreview> {
  const count = await countSmsQueue();
  if (count > 10) {
    const oldestFive = await getSmsQueue(5, 'asc');
    const newestFive = await getSmsQueue(5, 'desc');
    return { count, queue: [...oldestFive].reverse(), queueFirst: [...newestFive].reverse() };
  }
  const all = await getSmsQueue(count, 'asc');
  return { count, queue: [...all].reverse(), queueFirst: null };
}
