#!/usr/bin/env bun
// Ported from legacy `http/cron/onhold.cfm` — see docs/decisions/0026-cron-phase6.md. Meant
// for a VDS crontab entry (docs/decisions/0004-scheduled-jobs.md's "simple sweep" category),
// same as legacy's own scheduled hit against this URL. Runs against whatever DATABASE_URL is
// configured — including production — matching what the legacy cron job did; no
// guard-local-db check here (that guard is for `db:migrate`, not scheduled jobs).
//
// Reproduces legacy's 14 sequential statements in the same order, with the same hardcoded
// `created > '2023-09-01'` cutoff (kept as a literal, not derived — legacy never explains it
// and every parcel before it is presumably already fully settled) on all but the Delivery
// Request block, which legacy applies no cutoff to at all. `Store`/`Contents`'s `LEN(x) > 1`
// checks (SQL Server, no direct Prisma equivalent) are done by fetching broad candidates and
// filtering precisely in JS before the bulk update — same computed WHERE, just evaluated in
// two steps instead of one SQL statement.
import 'dotenv/config';
import { db } from '../../src/lib/db';
import { runJob } from '../../src/lib/jobs/runJob';
import { startsWithPDR } from '../../src/lib/parcels/onholdSweep';

const CUTOFF = new Date('2023-09-01T00:00:00Z');

// Legacy hardcodes this MSSQL GUID as the "Linoli" placeholder shipper (`GZ20001`) — the
// same account `scripts/seed-parcel-shippers.ts` seeds, resolved by username per
// docs/decisions/0022-parcels-online-add.md's precedent rather than carrying the dead GUID
// forward.
async function getLinoliUserId(): Promise<string | null> {
  const user = await db.user.findUnique({ where: { username: 'GZ20001' }, select: { id: true } });
  return user?.id ?? null;
}

async function main(): Promise<string> {
  const linoliUserId = await getLinoliUserId();
  const summary: string[] = [];

  await db.$transaction(async (tx) => {
    // 1. "Payment clear" — a parcel with only zero-amount invoice items (no real line item),
    // still owing debt, not delivered: the zero-amount items were a mistake, remove them.
    // `isPaid`/`isInvoiced` are trigger-derived from invoices_items existence, so this reuses
    // that instead of re-deriving the same EXISTS check legacy's correlated subquery does.
    const zeroInvoiceCandidates = await tx.parcel.findMany({
      where: {
        payAmount1: 0,
        debt: { gt: 0 },
        created: { gt: CUTOFF },
        trackingDeliveredSigned: null,
        invoiceItems: { some: { amount: 0 }, none: { amount: { gt: 0 } } },
      },
      select: { id: true },
    });
    if (zeroInvoiceCandidates.length) {
      const { count } = await tx.invoiceItem.deleteMany({
        where: { parcelId: { in: zeroInvoiceCandidates.map((p) => p.id) } },
      });
      summary.push(`cleared ${count} zero-amount invoice item(s) on ${zeroInvoiceCandidates.length} parcel(s)`);
    }

    // 2. Delivery Request (`DR-...`) parcels: mark the paid-delivery flag once either an
    // invoice exists or there's no debt — on both the DR- placeholder row and its "real"
    // sibling (same tracking number, `DR-` prefix stripped). No `created` cutoff here, unlike
    // every other statement in this job.
    const drCandidates = await tx.parcel.findMany({
      where: {
        trackingNum: { startsWith: 'DR-' },
        bPaidDelivery: false,
        OR: [{ isPaid: true }, { debt: 0 }, { debt: null }],
      },
      select: { id: true, trackingNum: true },
    });
    for (const parcel of drCandidates) {
      // Legacy's `Replace()` with no explicit scope only replaces the first occurrence —
      // matched here with JS's default single-occurrence `String.replace()`, not `replaceAll`.
      const strippedTrackingNum = parcel.trackingNum!.replace('DR-', '');
      await tx.parcel.update({ where: { id: parcel.id }, data: { bPaidDelivery: true } });
      await tx.parcel.updateMany({
        where: { trackingNum: strippedTrackingNum },
        data: { bPaidDelivery: true },
      });
    }
    if (drCandidates.length) summary.push(`marked ${drCandidates.length} delivery request(s) paid`);

    // 3. Personal-service parcels with no store set default to "Personal".
    const r3 = await tx.parcel.updateMany({
      where: { parcelType: 'Personal', OR: [{ store: null }, { store: '' }], created: { gt: CUTOFF } },
      data: { store: 'Personal' },
    });
    if (r3.count) summary.push(`set store=Personal on ${r3.count} Personal-type parcel(s)`);

    // 4. On-hold P/D/R-prefixed parcels with an *empty string* (not null) store also default
    // to "Personal" — deliberately narrower than #3's null-or-empty check, reproduced as-is.
    const store4Candidates = await tx.parcel.findMany({
      where: { bOnHold: true, store: '', created: { gt: CUTOFF } },
      select: { id: true, trackingNum: true },
    });
    const store4Ids = store4Candidates.filter((p) => startsWithPDR(p.trackingNum)).map((p) => p.id);
    if (store4Ids.length) {
      await tx.parcel.updateMany({ where: { id: { in: store4Ids } }, data: { store: 'Personal' } });
      summary.push(`set store=Personal on ${store4Ids.length} on-hold P/D/R parcel(s)`);
    }

    // 5. Same P/D/R on-hold parcels, zero declared value: bump to a nominal 0.01.
    const value5Candidates = await tx.parcel.findMany({
      where: { bOnHold: true, value: 0, created: { gt: CUTOFF } },
      select: { id: true, trackingNum: true },
    });
    const value5Ids = value5Candidates.filter((p) => startsWithPDR(p.trackingNum)).map((p) => p.id);
    if (value5Ids.length) {
      await tx.parcel.updateMany({ where: { id: { in: value5Ids } }, data: { value: 0.01 } });
      summary.push(`set value=0.01 on ${value5Ids.length} on-hold P/D/R parcel(s)`);
    }

    // 6. The actual on-hold rule: missing/placeholder Store/Value/Contents past the cutoff
    // trip date, excluding P/D/R-prefixed and Linoli's own parcels, not yet delivered, not
    // already on hold.
    const r6 = await tx.parcel.findMany({
      where: {
        OR: [
          { store: null },
          { store: '' },
          { store: 'Not Declared' },
          { value: 0 },
          { value: null },
          { contents: '' },
          { contents: null },
          { contents: 'Not Declared' },
        ],
        tripDate: { gt: new Date('2017-04-15T00:00:00Z') },
        ...(linoliUserId ? { userId: { not: linoliUserId } } : {}),
        bOnHold: false,
        trackingDeliveredSigned: null,
        created: { gt: CUTOFF },
      },
      select: { id: true, trackingNum: true },
    });
    const onHoldIds = r6.filter((p) => !startsWithPDR(p.trackingNum)).map((p) => p.id);
    if (onHoldIds.length) {
      await tx.parcel.updateMany({ where: { id: { in: onHoldIds } }, data: { bOnHold: true } });
      summary.push(`set bOnHold on ${onHoldIds.length} parcel(s)`);
    }

    // 7. The inverse: a previously-on-hold parcel that now has real Store/Value/Contents
    // (length > 1 for Store/Contents — not just "non-empty") gets taken off hold, unless it's
    // "Not Declared" (allowed through for Linoli's own parcels, matching #6's exemption).
    const r7 = await tx.parcel.findMany({
      where: {
        bOnHold: true,
        bNotOnHold: false,
        value: { gt: 0 },
        trackingDeliveredSigned: null,
        created: { gt: CUTOFF },
        store: { not: null },
        contents: { not: null },
      },
      select: { id: true, store: true, contents: true, userId: true },
    });
    const notOnHoldIds = r7
      .filter((p) => {
        const store = p.store ?? '';
        const contents = p.contents ?? '';
        const isLinoli = linoliUserId !== null && p.userId === linoliUserId;
        const storeOk = store.length > 1 && (store !== 'Not Declared' || isLinoli);
        const contentsOk = contents.length > 0 && (contents !== 'Not Declared' || isLinoli);
        return storeOk && contentsOk;
      })
      .map((p) => p.id);
    if (notOnHoldIds.length) {
      await tx.parcel.updateMany({ where: { id: { in: notOnHoldIds } }, data: { bNotOnHold: true } });
      summary.push(`set bNotOnHold on ${notOnHoldIds.length} parcel(s)`);
    }

    // 8. Linoli's own parcels never actually go through hold review — always reset both flags.
    if (linoliUserId) {
      const r8 = await tx.parcel.updateMany({
        where: { userId: linoliUserId, OR: [{ bOnHold: true }, { bNotOnHold: true }], created: { gt: CUTOFF } },
        data: { bNotOnHold: false, bOnHold: false },
      });
      if (r8.count) summary.push(`reset hold flags on ${r8.count} Linoli parcel(s)`);
    }

    // 9. A delivered parcel should never still carry a hold flag — data-integrity cleanup.
    const r9 = await tx.parcel.updateMany({
      where: {
        trackingDeliveredSigned: { not: null },
        OR: [{ bOnHold: true }, { bNotOnHold: true }],
        created: { gt: CUTOFF },
      },
      data: { bNotOnHold: false, bOnHold: false },
    });
    if (r9.count) summary.push(`reset hold flags on ${r9.count} delivered parcel(s)`);

    // 10/11. On-hold parcels not yet shipped/delivered/at-office get their trip pushed to the
    // next scheduled Express/Regular trip out of `Config`, per service type.
    const config = await tx.config.findUnique({ where: { id: 1 } });
    if (config) {
      const notMoved = {
        bOnHold: true,
        trackingShipped: null,
        trackingDeliveredSigned: null,
        trackingOffice: null,
        created: { gt: CUTOFF },
      } as const;

      if (config.dtExpressShip) {
        const r10 = await tx.parcel.updateMany({
          where: { ...notMoved, service: 'express', tripDate: { lt: config.dtExpressShip } },
          data: {
            tripDate: config.dtExpressShip,
            trackingEstDelivery: config.dtExpressEst,
            trackingEstShip: config.dtExpressShip,
            awb: config.expAwb,
          },
        });
        if (r10.count) summary.push(`rescheduled ${r10.count} on-hold Express parcel(s)`);
      }

      if (config.dtRegularShip) {
        const r11 = await tx.parcel.updateMany({
          where: { ...notMoved, service: 'regular', tripDate: { lt: config.dtRegularShip } },
          data: {
            tripDate: config.dtRegularShip,
            trackingEstDelivery: config.dtRegularEst,
            trackingEstShip: config.dtRegularShip,
            awb: config.regAwb,
          },
        });
        if (r11.count) summary.push(`rescheduled ${r11.count} on-hold Regular parcel(s)`);
      }
    }

    // 12. A parcel sent to region more than 7 days ago with no delivery confirmation is
    // presumed delivered — auto-stamp it.
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const regionCandidates = await tx.parcel.findMany({
      where: {
        trackingDeliveredSigned: null,
        trackingSendRegion: { not: null, lt: sevenDaysAgo },
        created: { gt: CUTOFF },
      },
      select: { id: true, trackingSendRegion: true },
    });
    for (const p of regionCandidates) {
      const deliveredAt = new Date(p.trackingSendRegion!);
      deliveredAt.setDate(deliveredAt.getDate() + 7);
      await tx.parcel.update({ where: { id: p.id }, data: { trackingDeliveredSigned: deliveredAt } });
    }
    if (regionCandidates.length) summary.push(`auto-delivered ${regionCandidates.length} region parcel(s)`);

    // 13. An estimated-delivery date that's fallen more than a day behind "today" (date-only)
    // gets nudged forward a day — keeps a stale estimate crawling toward reality rather than
    // sitting frozen in the past.
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const yesterdayMidnight = new Date(todayMidnight);
    yesterdayMidnight.setDate(yesterdayMidnight.getDate() - 1);
    const staleEstimateCandidates = await tx.parcel.findMany({
      where: {
        trackingDeliveredSigned: null,
        trackingEstDelivery: { not: null, lt: yesterdayMidnight },
        created: { gt: CUTOFF },
      },
      select: { id: true, trackingEstDelivery: true },
    });
    for (const p of staleEstimateCandidates) {
      const nudged = new Date(p.trackingEstDelivery!);
      nudged.setDate(nudged.getDate() + 1);
      await tx.parcel.update({ where: { id: p.id }, data: { trackingEstDelivery: nudged } });
    }
    if (staleEstimateCandidates.length) summary.push(`nudged ${staleEstimateCandidates.length} stale estimate(s)`);

    // 14. A parcel marked delivered/at-office without ever being marked received is a data
    // anomaly — clear both so it re-enters the normal tracking flow.
    const r14 = await tx.parcel.updateMany({
      where: { trackingReceived: null, trackingDeliveredSigned: { not: null }, created: { gt: CUTOFF } },
      data: { trackingDeliveredSigned: null, trackingOffice: null },
    });
    if (r14.count) summary.push(`cleared ${r14.count} received-but-never-marked-received parcel(s)`);
  });

  return summary.length ? summary.join('; ') : 'no changes';
}

runJob('onhold', main)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
