import { db } from '@/lib/db';
import { formatUpdaterName } from '@/lib/services/parcelHistory';

// "Parcels Reports 2" — legacy `bema/parcels/parcels-reports-2-v2.cfm` +
// `views/parcels/vwParcelsReports2-v2.cfm`. The "-v2" suffix is the version actually linked
// from the sidebar (`lytBema.cfm`); the plain `parcels-reports-2.cfm`/`vwParcelsReports2.cfm`
// (no `exclude-agents.cfm`, no `ph.updaterID NOT IN (...)` filter) is not reachable from any
// live link and was not ported.
//
// This report reads the *same* `parcel_history` edit log as the "Parcels Reports" screen
// (parcelReports.ts / docs/decisions/0018-parcel-edit-history.md), but is otherwise an
// independent query with its own filter set and its own money-bucketing rules — the two
// screens are not variants of each other in legacy and are not treated as such here.
//
// Three-valued-SQL traps this port had to reproduce, all confirmed against Postgres's `<>`
// semantics the same way the sibling report's were:
//  * `ph.updaterID NOT IN ('26259424-...')` (the single hardcoded exclude-agents.cfm id,
//    "Exclude MR from financial reports due to role change") also drops every row whose
//    updaterId is NULL — legacy's `NOT IN` against a NULL column is NULL, not true.
//  * `ur.username not like '%chicago%'`, where `ur` is `parcels.tracking_received_by`
//    LEFT JOINed to `users` — a NULL `tracking_received_by` makes `ur.username` NULL, and
//    `NULL NOT LIKE '%chicago%'` is NULL too. So **only parcels that have a
//    `trackingReceivedBy` admin set** appear in this report at all; that admin's name is what
//    the "Received by" column shows (via `formatUpdaterName`, safe here because the row is
//    guaranteed to have one).
//
// Legacy wraps `valuename`/`payMethod` comparisons in `LOWER(...)`, unlike the sibling
// report's plain `=`. This app's own writers (parcelHistory.ts) only ever produce the exact
// casings `'Paid'`/`'Unpaid'`/`'Debt'`, so an exact-case match is used here to keep the
// `(value_name, edit_date_time)` index usable — same simplification already made for the
// sibling report's `valueName: 'Paid'`, for the same reason (no legacy-cased data has been
// imported yet). See docs/findings.md for the full list of what this changes if/when legacy
// data with different casing is imported.

const EXCLUDED_AGENT_ID = '26259424-F3BB-ABC7-6C6C159A66E573A9';

export type ParcelsSalesReportRange = { start: Date; end: Date };

export type SalesReportRow = {
  id: string;
  editDateTime: string;
  created: string;
  accNum: string;
  notes: string | null;
  firstName: string | null;
  lastName: string;
  trackingNum: string;
  service: string | null;
  weight: number | null;
  /** Column "Paid" — `null` renders as a blank cell, matching legacy's blank span. */
  paidAmount: number | null;
  /** The CSS-class-equivalent bucket key legacy's `pm-<key>` span carried, used client-side
   *  for the per-column Payment Type search and the live-recalculated ("count2") totals. */
  paidClass: string;
  paymentType: string;
  debt: number;
  received: string | null;
  receivedBy: string;
};

export type SalesTotals = {
  cashUs: number;
  cashGe: number;
  ccUs: number;
  ccGe: number;
  check: number;
  deposit: number;
  authorize: number;
  paypal: number;
  balance: number;
};

export type BemaUserOption = { username: string; firstName: string | null; lastName: string | null };

export type ParcelsSalesReportResult = {
  rows: SalesReportRow[];
  /** Totals for the payment events whose *parcel* was created inside the selected date
   *  range — legacy's `TotalSalesParcels`. */
  ttl: SalesTotals;
  /** Totals for the payment events whose *parcel* was created outside the selected date
   *  range (an older parcel paid during this window) — legacy's `TotalByTracking`. */
  tbt: SalesTotals;
  /** legacy `bemausers` — active `typeId=1` accounts (agents included, same as legacy: the
   *  dropdown source doesn't filter by admin role), for the "Received by" column filter. */
  bemaUsers: BemaUserOption[];
};

export type RowDisplayInput = {
  payMethod1: string | null;
  payMethod2: string | null;
  payAmount1: number | null;
  payAmount2: number | null;
  onlineSource: string | null;
  debt: number | null;
  /** `ph.payMethod` — the joined history event's own method, not the parcel's. */
  eventPayMethod: string | null;
  /** The parcel's latest paid/unpaid non-debt `valueName`, across all time (see the
   *  "latestValueName" comment on the main query below). */
  latestValueName: string;
};

export type RowDisplay = {
  pmshow: string;
  paidAmount: number | null;
  paidClass: string;
  paymentType: string;
  debt: number;
};

/** Columns "Paid" / "Payment Type" / "Debt" — the per-row view logic, extracted as a pure
 *  function so its two Debt-blanking sentinels (`''` for "Paid", `0` for "Debt") can be
 *  tested directly. See parcelReports2.test.ts. */
export function computeRowDisplay(input: RowDisplayInput): RowDisplay {
  // `paymethod1_t` — the parcel's own `pay_method1`, overridden by `OnlineSource` for
  // online-collected payments.
  const paymethod1T =
    input.onlineSource === 'Authorize.net' || input.onlineSource === 'PayPal' ? input.onlineSource : input.payMethod1;

  // `pmshow` — legacy's `isDefined('typeId') && ...` arm is never true on the only reachable
  // controller path (`url.fromMC eq 1` never selects `updaterr.typeId`), so this collapses to
  // a single check (see docs/findings.md).
  const pmshow = input.eventPayMethod === 'balance' ? input.eventPayMethod : (paymethod1T ?? '');

  // Column "Paid": the Debt-financed slot is blanked to `null` (not `0`), so a parcel paid
  // entirely on debt falls through to the "Paid" debt-amount fallback.
  const payAmount1 = input.payAmount1 == null ? 0 : input.payAmount1;
  const payAmount2 = input.payAmount2 == null ? 0 : input.payAmount2;
  const tPay1Blank = paymethod1T === 'Debt' ? null : payAmount1;
  const tPay2Blank = input.payMethod2 === 'Debt' ? null : payAmount2;
  let paidAmount: number | null;
  if (tPay1Blank !== null || tPay2Blank !== null) {
    paidAmount = (tPay1Blank ?? 0) + (tPay2Blank ?? 0);
  } else if (input.latestValueName === 'Paid') {
    paidAmount = input.debt == null ? 0 : input.debt;
  } else {
    paidAmount = null;
  }
  const paidClass = input.payMethod2 || (pmshow !== 'Debt' ? pmshow : '');

  // Column "Payment Type".
  const paymentTypeParts: string[] = [];
  if (pmshow !== 'Debt') paymentTypeParts.push(pmshow);
  if (input.payMethod2 && input.payMethod2 !== 'Debt') paymentTypeParts.push(`(${input.payMethod2})`);
  if (pmshow === 'CreditCard') paymentTypeParts.push('US');
  const paymentType = paymentTypeParts.join(' ');

  // Column "Debt": the Debt-financed slot is zeroed to `0` here (not blanked, unlike column
  // "Paid" above) — legacy uses two different sentinels for the same condition in the two
  // columns. Because of that, this branch is always reachable and legacy's other `elseif`
  // branches for this column are dead code (see docs/findings.md).
  const tPay1Zero = paymethod1T === 'Debt' ? 0 : payAmount1;
  const tPay2Zero = input.payMethod2 === 'Debt' ? 0 : payAmount2;
  const debt = input.debt == null ? 0 : input.debt - tPay1Zero - tPay2Zero;

  return { pmshow, paidAmount, paidClass, paymentType, debt };
}

function emptyTotals(): SalesTotals {
  return { cashUs: 0, cashGe: 0, ccUs: 0, ccGe: 0, check: 0, deposit: 0, authorize: 0, paypal: 0, balance: 0 };
}

/** Legacy `sortPayments()`. `method != "Debt"` is dead here in practice (the main query's
 *  `payMethod != 'Debt'` filter already guarantees it), kept for fidelity. */
export function sortPayments(amount: number, method: string | null, totals: SalesTotals) {
  if (amount === 0 || !method || method === 'Debt') return;
  const m = method.toLowerCase();
  if (m.includes('card ge')) totals.ccGe += amount;
  else if (m.includes('card')) totals.ccUs += amount;
  else if (m.includes('cash ge')) totals.cashGe += amount;
  else if (m.includes('cash')) totals.cashUs += amount;
  else if (m.includes('check')) totals.check += amount;
  // No fallback bucket — a method matching none of the above (e.g. a bare "PayPal" payMethod
  // not routed through `OnlineSource`) is silently dropped from every total, same as legacy.
}

export type HistoryForTotals = {
  parcelId: string;
  payMethod: string | null;
  payAmount: { toString(): string } | number | null;
  parcel: { onlineSource: string | null };
};

/** Legacy `getTotals()`. Reads `ph.PayAmount` (the event's own amount), **not**
 *  `parcels.pay_amount1` — a different amount source than the per-row "Paid" column below,
 *  which does read the parcel's current `pay_amount1`/`pay_amount2`. Both are legacy's own
 *  choices, kept distinct rather than unified. */
export function accumulateTotals(rows: HistoryForTotals[], latestValueNameByParcel: Map<string, string>): SalesTotals {
  const totals = emptyTotals();
  for (const row of rows) {
    let payAmount1 = row.payAmount == null ? 0 : Number(row.payAmount);
    const payAmount2 = 0; // legacy's `tt.PayAmount2 = 0`, always — see the file header.

    const latestValueName = latestValueNameByParcel.get(row.parcelId) ?? '';
    if (latestValueName.toLowerCase() === 'unpaid') {
      payAmount1 = -payAmount1;
    }

    if (row.parcel.onlineSource === 'Authorize.net') {
      totals.authorize += payAmount1 + payAmount2;
    } else if (row.parcel.onlineSource === 'PayPal') {
      totals.paypal += payAmount1 + payAmount2;
    } else if (row.payMethod === 'balance') {
      totals.balance += payAmount1 + payAmount2;
    } else if (row.payMethod === 'Deposit') {
      totals.deposit += payAmount1 + payAmount2;
    } else {
      sortPayments(payAmount1, row.payMethod, totals);
      sortPayments(payAmount2, row.payMethod, totals); // always 0 — a no-op, kept for fidelity.
    }
  }
  return totals;
}

export async function getParcelsSalesReport(range: ParcelsSalesReportRange): Promise<ParcelsSalesReportResult> {
  // Legacy: `ur.username not like '%chicago%'` where `ur` is `tracking_received_by` LEFT
  // JOINed to `users`. Resolved as a separate lookup (same idiom as `parcelQuery.ts`'s
  // `loadAdminNames`) since `trackingReceivedBy` is a bare id column, not a Prisma relation.
  const chicagoAdmins = await db.user.findMany({
    where: { username: { contains: 'chicago', mode: 'insensitive' } },
    select: { id: true },
  });
  const chicagoAdminIds = chicagoAdmins.map((u) => u.id);

  const historyRows = await db.parcelHistory.findMany({
    where: {
      editDateTime: { gt: range.start, lte: range.end },
      valueName: { in: ['Paid', 'Unpaid'] },
      payMethod: { not: 'Debt' },
      updaterId: { not: EXCLUDED_AGENT_ID },
      parcel: { trackingReceivedBy: { not: null, notIn: chicagoAdminIds } },
    },
    include: {
      parcel: {
        select: {
          id: true,
          trackingNum: true,
          service: true,
          weight: true,
          debt: true,
          payMethod1: true,
          payMethod2: true,
          payAmount1: true,
          payAmount2: true,
          notes: true,
          additionalFirstname: true,
          additionalLastname: true,
          onlineSource: true,
          trackingReceivedBy: true,
          trackingReceived: true,
          created: true,
          user: { select: { username: true, firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { editDateTime: 'asc' },
  });

  // Legacy's per-parcel `(SELECT TOP 1 valuename FROM ParcelHistory WHERE ... ORDER BY
  // editdatetime DESC)` — unlike the main filter, this looks across the parcel's *entire*
  // history, not just the selected date window, and it is what column "Paid"'s debt-fallback
  // and `getTotals()`'s sign-flip both key off. Fetched in one extra query rather than N.
  const parcelIds = Array.from(new Set(historyRows.map((row) => row.parcelId)));
  const latestForParcels =
    parcelIds.length === 0
      ? []
      : await db.parcelHistory.findMany({
          where: { parcelId: { in: parcelIds }, valueName: { in: ['Paid', 'Unpaid'] }, payMethod: { not: 'Debt' } },
          select: { parcelId: true, valueName: true },
          orderBy: { editDateTime: 'desc' },
        });
  const latestValueNameByParcel = new Map<string, string>();
  for (const row of latestForParcels) {
    if (!latestValueNameByParcel.has(row.parcelId)) latestValueNameByParcel.set(row.parcelId, row.valueName ?? '');
  }

  // "Received by" — resolved separately from `parcel.user` above for the same reason as the
  // chicago exclusion: `trackingReceivedBy` isn't a Prisma relation. Guaranteed non-null here
  // (the `trackingReceivedBy: { not: null }` filter above), so `formatUpdaterName` never has
  // to synthesize the "no admin" case.
  const receivedByIds = Array.from(
    new Set(historyRows.map((row) => row.parcel.trackingReceivedBy).filter((id): id is string => !!id)),
  );
  const receivedByAdmins =
    receivedByIds.length === 0
      ? []
      : await db.user.findMany({
          where: { id: { in: receivedByIds } },
          select: { id: true, firstName: true, lastName: true, username: true },
        });
  const receivedByName = new Map(receivedByAdmins.map((admin) => [admin.id, formatUpdaterName(admin)]));

  const rows: SalesReportRow[] = historyRows.map((row) => {
    const p = row.parcel;
    const latestValueName = latestValueNameByParcel.get(row.parcelId) ?? '';

    const { paidAmount, paidClass, paymentType, debt } = computeRowDisplay({
      payMethod1: p.payMethod1,
      payMethod2: p.payMethod2,
      payAmount1: p.payAmount1 == null ? null : Number(p.payAmount1),
      payAmount2: p.payAmount2 == null ? null : Number(p.payAmount2),
      onlineSource: p.onlineSource,
      debt: p.debt == null ? null : Number(p.debt),
      eventPayMethod: row.payMethod,
      latestValueName,
    });

    return {
      id: row.id,
      editDateTime: row.editDateTime.toISOString(),
      created: p.created.toISOString(),
      accNum: p.user.username,
      notes: p.notes,
      firstName: p.additionalFirstname || p.user.firstName,
      lastName: p.additionalLastname || p.user.lastName || '',
      trackingNum: p.trackingNum ?? '',
      service: p.service,
      weight: p.weight === null ? null : Number(p.weight),
      paidAmount,
      paidClass,
      paymentType,
      debt,
      received: p.trackingReceived ? p.trackingReceived.toISOString().slice(0, 10) : null,
      receivedBy: p.trackingReceivedBy ? (receivedByName.get(p.trackingReceivedBy) ?? '') : '',
    };
  });

  // ttl/tbt — split by the *parcel's* `created`, not by `editDateTime` (already narrowed by
  // the main query's WHERE). Legacy runs this as two "query of query" passes over the same
  // in-memory recordset; done here as two array filters over the same in-memory rows.
  const ttlRows: HistoryForTotals[] = [];
  const tbtRows: HistoryForTotals[] = [];
  for (const row of historyRows) {
    const created = row.parcel.created;
    const inRange = created >= range.start && created <= range.end;
    (inRange ? ttlRows : tbtRows).push(row);
  }

  const bemaUsers = await db.user.findMany({
    where: { accountType: 'BemaUser', active: true },
    select: { username: true, firstName: true, lastName: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  return {
    rows,
    ttl: accumulateTotals(ttlRows, latestValueNameByParcel),
    tbt: accumulateTotals(tbtRows, latestValueNameByParcel),
    bemaUsers,
  };
}
