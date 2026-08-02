#!/usr/bin/env bun
// Ported from legacy `http/cron/changeParcelStatus.cfm` — see
// docs/decisions/0026-cron-phase6.md. Received→Shipped auto-transition: a parcel whose trip
// date was yesterday and is still sitting at "Received" gets its `TrackingShipped` stamped
// with that trip date (copied, not "now"), plus an `Operation` log row. VDS crontab entry,
// same "simple sweep" category as `onhold.ts`.
//
// Legacy re-derives status with its own 11-branch CASE (no `TrackingSendRegion`/
// `TrackingProcessingCustom` checks at all, unlike the trigger-maintained `Parcel.status`).
// Reusing `Parcel.status === 'Received'` here — the same call already made for
// `getParcel.cfm`/`sms_add_bulk.cfm` — is a very close but not perfect match; see
// docs/findings.md for the specific edge case this diverges on.
import 'dotenv/config';
import { db } from '../../src/lib/db';
import { runJob } from '../../src/lib/jobs/runJob';

const CUTOFF = new Date('2023-11-01T00:00:00Z');

function yesterdayDateOnly(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function main(): Promise<string> {
  const tripDate = yesterdayDateOnly();

  const candidates = await db.parcel.findMany({
    where: { tripDate, created: { gt: CUTOFF }, status: 'Received' },
    select: { id: true },
  });
  if (!candidates.length) return 'no changes';

  await db.$transaction(async (tx) => {
    await tx.parcel.updateMany({
      where: { id: { in: candidates.map((p) => p.id) } },
      data: { trackingShipped: tripDate },
    });
    await tx.operation.createMany({
      data: candidates.map((p) => ({ parcelId: p.id, operation: 'shipped', operationTime: tripDate })),
    });
  });

  return `shipped ${candidates.length} parcel(s) with trip date ${tripDate.toISOString().slice(0, 10)}`;
}

runJob('change-parcel-status', main)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
