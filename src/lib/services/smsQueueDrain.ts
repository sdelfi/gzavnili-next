import { db } from '@/lib/db';
import { sendSms, type SmsCountry } from '@/lib/services/smsGateway';

// Ports `cron/processSMSQueue.cfm` — the `sms_queue` drain "Send Bulk SMS" enqueues into (see
// docs/decisions/0025-bema-send-bulk-sms.md) and docs/decisions/0026-cron-phase6.md. Not a
// simple sweep — legacy already ran this as a tight interval (`interval = 180`, every 3
// minutes) needing retries/backpressure, exactly BullMQ's "queue-worthy" category per
// docs/decisions/0004-scheduled-jobs.md, unlike `onhold.ts`/`change-parcel-status.ts`.

export type DrainQueueRow = { id: number; phone: string; text: string; phoneType: string };

// `US` rows send individually, right when encountered. `GE` rows don't send inline at all —
// they're grouped by *exact-matching* message text within the batch, phones comma-joined, and
// sent as one gateway call per unique text only after every row in the batch has been
// classified. Reproduced as two passes for the same reason: legacy's own `bulkGePhones`
// grouping only happens after its `<cfloop query="#queue#">` finishes.
export function groupGeRowsByText(rows: DrainQueueRow[]): { phones: string; text: string }[] {
  const groups: { phones: string; text: string }[] = [];
  for (const row of rows) {
    const existing = groups.find((g) => g.text === row.text);
    if (existing) {
      existing.phones = `${existing.phones},${row.phone.trim()}`;
    } else {
      groups.push({ text: row.text, phones: row.phone.trim() });
    }
  }
  return groups;
}

export type DrainResult = { queueCountAtStart: number; processed: number };

// Legacy processes at most `limit` (default 50) oldest-queued rows per run, inserts a
// `Messages` row for every one of them unconditionally (no `userId`/`parcelId`/`senderId` —
// same as "Send SMS"'s own insert, see docs/decisions/0024-bema-send-sms.md), attempts to
// send every row regardless of whether the insert or a previous row's send succeeded (no
// error handling around any of it), and only then deletes the exact rows it just processed
// (by id — not a blanket `DELETE`, so anything enqueued *during* this run is untouched).
export async function drainSmsQueue(limit = 50): Promise<DrainResult> {
  const queueCountAtStart = await db.smsQueueEntry.count();
  if (limit <= 0 || queueCountAtStart === 0) return { queueCountAtStart, processed: 0 };

  const rows = await db.smsQueueEntry.findMany({
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit,
  });
  if (!rows.length) return { queueCountAtStart, processed: 0 };

  await db.message.createMany({
    data: rows.map((row) => ({ isSms: true, smsBody: row.text, smsTo: row.phone })),
  });

  const geRows: DrainQueueRow[] = [];
  for (const row of rows) {
    const phoneType = row.phoneType.trim().toLowerCase();
    if (phoneType === 'us') {
      await sendSms(row.phone, row.text, 'US' as SmsCountry);
    } else if (phoneType === 'ge') {
      geRows.push(row);
    }
  }

  for (const group of groupGeRowsByText(geRows)) {
    await sendSms(group.phones, group.text, 'GE' as SmsCountry);
  }

  await db.smsQueueEntry.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });

  return { queueCountAtStart, processed: rows.length };
}
