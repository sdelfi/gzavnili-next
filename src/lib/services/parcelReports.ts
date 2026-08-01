import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { formatUpdaterName } from '@/lib/services/parcelHistory';

// "Parcels Reports" — legacy `bema/parcels/parcels-reports.cfm` + `views/parcels/
// vwParcelsReports.cfm`, ported against the restored `parcel_history` table
// (docs/decisions/0018-parcel-edit-history.md). Every figure on this screen comes from the
// same edit-log rows legacy reads, so the numbers are the legacy numbers.
//
// Three queries, mirroring legacy's three `<cfquery>` blocks. All three share the same
// window predicate and the same two legacy filters:
//   * `p.trackingnum <> ''` — note this is SQL `<>`, so a NULL tracking number is excluded
//     too. Prisma's `{ not: '' }` compiles to a bare `<> $1` (verified against Postgres), so
//     the three-valued behaviour matches MSSQL's without needing a special case.
//   * `updaterrGroup.groupid IS NULL` — legacy LEFT JOINs `users_groups` on `GroupId = 15`
//     (the BEMA-agent group, same id the batch-add flat rate keys off) and keeps only the
//     rows where that join found nothing: **exclude edits made by agents**. Expressed here as
//     `NOT: { updater: { adminRole: 'BemaAgent' } }`, which — unlike a positive
//     `updater: { adminRole: { not: ... } }` filter — correctly keeps rows whose updater is
//     NULL (legacy's LEFT JOIN keeps those too; `money-collect.cfm`'s backfill writes them).

export type ParcelsReportRange = { start: Date; end: Date };

export type PaidTransactionRow = {
  id: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  trackingNum: string;
  service: string | null;
  weight: number | null;
  payAmount: number | null;
  payMethod: string | null;
  debt: number | null;
  /** Legacy's "Received by" column — the admin who processed the payment, not the receiver. */
  receivedBy: string;
  editDateTime: string;
};

export const TOTAL_SALE_KEYS = ['Express', 'Regular', 'Cargo', 'Linoli', 'Unknown'] as const;
type TotalSaleKey = (typeof TOTAL_SALE_KEYS)[number];
export type TotalSaleBuckets = Record<TotalSaleKey | 'Total', { weight: number; cost: number }>;

export type KeyedAmount = { key: string; amount: number };

export type HistoryRow = {
  id: string;
  editDateTime: string;
  editStatus: string | null;
  oldValue: string | null;
  newValue: string | null;
  valueName: string | null;
  payMethod: string | null;
  payAmount: number | null;
};

export type ParcelsReportResult = {
  transactions: PaidTransactionRow[];
  transactionsTotals: { weight: number; payAmount: number; debt: number };
  totalSale: TotalSaleBuckets;
  paymentCollected: KeyedAmount[];
  paymentCollectedTotal: number;
  remainPayment: KeyedAmount[];
  remainPaymentTotal: number;
  collectedUs: KeyedAmount[];
  collectedUsTotal: number;
  collectedGe: KeyedAmount[];
  collectedGeTotal: number;
  history: HistoryRow[];
};

// Legacy's two hardcoded customer ids, kept as named constants so the branches below read the
// same as the legacy source. Both are legacy MSSQL GUIDs; no legacy customer data has been
// imported yet (ETL not started), so neither matches a row in this schema today and both
// buckets stay at 0 — the rows are still rendered, matching the legacy layout.
const UNKNOWN_CUSTOMER_ID = '58133650-0FEC-1BB8-E0173C7510B54DD4';
const LINOLI_CUSTOMER_ID = '581ACE56-EEE2-E30F-50E6B1F3359ECAAE';

// `vwParcelsReports.cfm`'s `BemaGE`/`BemaUS` lists, verbatim — comma-delimited CF lists
// matched with `ListFindNoCase`, so matching is case-insensitive. `'Kote '` (trailing space)
// is a genuine separate list element in the legacy source, kept rather than tidied: it can
// never match a real username, but removing it would be an edit to legacy data, not a port.
const BEMA_GE_USERNAMES = ['GZ10975', 'tornikero', 'ika-mg', 'Beqa-Maisuradze', 'GZ10996'];
const BEMA_US_USERNAMES = ['Kote', 'gzavnili', 'Kote ', 'Datunia', 'Badri'];

const listFindNoCase = (list: string[], value: string) =>
  list.some((entry) => entry.toLowerCase() === value.toLowerCase());

/** Legacy `val()`: a non-numeric/empty value is 0, never NaN. */
const val = (value: Prisma.Decimal | null | undefined) => (value == null ? 0 : Number(value));

function relabelPaymentMethod(payMethod: string): string {
  // `vwParcelsReports.cfm`'s `PaymentColectedKey` remap. The `CreditCard GEO` arm never
  // matches anything this app can store (the real GE value is `CreditCard GE`) — kept because
  // it is what legacy does, and legacy-imported rows may well carry the old spelling.
  if (payMethod === 'CreditCard GEO') return 'Credit Card GE';
  if (payMethod === 'CreditCard') return 'Credit Card US';
  return payMethod;
}

/** Shared by all three queries — see the file header. */
function baseWhere(range: ParcelsReportRange): Prisma.ParcelHistoryWhereInput {
  return {
    editDateTime: { gt: range.start, lte: range.end },
    parcel: { trackingNum: { not: '' } },
    NOT: { updater: { adminRole: 'BemaAgent' } },
  };
}

export async function getParcelsReport(range: ParcelsReportRange): Promise<ParcelsReportResult> {
  const [paidRows, remainRows, historyRows] = await Promise.all([
    // Q1 `TotalSalesParcels`: the payment events. Served by
    // `parcel_history_value_name_edit_date_time_idx` — equality on value_name, then the range.
    db.parcelHistory.findMany({
      where: { ...baseWhere(range), valueName: 'Paid', payMethod: { not: 'Debt' } },
      include: {
        parcel: { select: { id: true, userId: true, trackingNum: true, service: true, weight: true, debt: true, payAmount1: true } },
        updater: { select: { firstName: true, lastName: true, username: true, billingAddress: { select: { country: true } } } },
      },
      orderBy: { editDateTime: 'asc' },
    }),

    // Q2 `RemainPaymentQ`. Legacy's `p.paymethod2 != 'Dept' AND != 'Depth' AND != 'Debt'` is
    // three `<>` comparisons, so a parcel whose payMethod2 is NULL is **excluded entirely** —
    // faithfully reproduced here rather than treated as "no debt-method set, so include it".
    db.parcelHistory.findMany({
      where: {
        ...baseWhere(range),
        parcel: {
          trackingNum: { not: '' },
          payMethod2: { not: 'Dept' },
          AND: [{ payMethod2: { not: 'Depth' } }, { payMethod2: { not: 'Debt' } }],
        },
      },
      include: {
        parcel: {
          select: {
            id: true,
            userId: true,
            debt: true,
            payAmount1: true,
            payAmount2: true,
            user: { select: { billingAddress: { select: { country: true } } } },
          },
        },
      },
      orderBy: { editDateTime: 'desc' },
    }),

    // Q3 `History`: everything in the window that isn't a creation or a payment.
    db.parcelHistory.findMany({
      where: {
        ...baseWhere(range),
        editStatus: { not: 'Added' },
        AND: [{ editStatus: { not: 'Paid' } }],
      },
      orderBy: { editDateTime: 'desc' },
    }),
  ]);

  // --- "Paid transactions" tab ------------------------------------------------------------
  // The sender's account-number/name columns are fetched in one keyed query rather than as a
  // per-row join include, so a 10k-row window costs one extra query, not 10k.
  const senderIds = Array.from(new Set(paidRows.map((row) => row.parcel.userId)));
  const senders = await db.user.findMany({
    where: { id: { in: senderIds } },
    select: { id: true, username: true, firstName: true, lastName: true },
  });
  const senderById = new Map(senders.map((sender) => [sender.id, sender]));

  const transactions: PaidTransactionRow[] = paidRows.map((row) => {
    const sender = senderById.get(row.parcel.userId);
    return {
      id: row.id,
      username: sender?.username ?? '',
      firstName: sender?.firstName ?? null,
      lastName: sender?.lastName ?? null,
      trackingNum: row.parcel.trackingNum ?? '',
      service: row.parcel.service,
      weight: row.parcel.weight === null ? null : Number(row.parcel.weight),
      payAmount: row.payAmount === null ? null : Number(row.payAmount),
      payMethod: row.payMethod,
      debt: row.parcel.debt === null ? null : Number(row.parcel.debt),
      receivedBy: row.updater ? `${row.updater.firstName ?? ''} ${row.updater.lastName ?? ''}`.trim() : '',
      editDateTime: row.editDateTime.toISOString(),
    };
  });

  // Legacy's footer sums every displayed row, treating blanks as 0.
  const transactionsTotals = transactions.reduce(
    (acc, row) => ({
      weight: acc.weight + (row.weight ?? 0),
      payAmount: acc.payAmount + (row.payAmount ?? 0),
      debt: acc.debt + (row.debt ?? 0),
    }),
    { weight: 0, payAmount: 0, debt: 0 },
  );

  // --- Total Sale ---------------------------------------------------------------------------
  // `<cfloop group="PARCELID">`: one contribution per parcel, reading the parcel's *current*
  // weight/debt (not a historical value — legacy reads them off the joined `parcels` row).
  const totalSale = TOTAL_SALE_KEYS.reduce(
    (acc, key) => ({ ...acc, [key]: { weight: 0, cost: 0 } }),
    { Total: { weight: 0, cost: 0 } } as TotalSaleBuckets,
  );
  const seenParcelIds = new Set<string>();
  for (const row of paidRows) {
    if (seenParcelIds.has(row.parcelId)) continue;
    seenParcelIds.add(row.parcelId);

    const { weight, debt, service, userId } = row.parcel;
    if (weight === null || debt === null) continue; // legacy: `weight neq "" && debt neq ""`
    const weightNum = Number(weight);
    const debtNum = Number(debt);

    totalSale.Total.weight += weightNum;
    totalSale.Total.cost += debtNum;

    if (userId === UNKNOWN_CUSTOMER_ID) {
      totalSale.Unknown.weight += weightNum;
      totalSale.Unknown.cost += debtNum;
    } else if (userId === LINOLI_CUSTOMER_ID) {
      totalSale.Linoli.weight += weightNum;
      totalSale.Linoli.cost += debtNum;
    } else if (service === 'Express' || service === 'Regular' || service === 'Cargo') {
      totalSale[service].weight += weightNum;
      totalSale[service].cost += debtNum;
    }
  }

  // --- Payment Colected ----------------------------------------------------------------------
  // Every payment event's own amount, bucketed by its own method — not deduped by parcel.
  const paymentCollectedMap = new Map<string, number>();
  let paymentCollectedTotal = 0;
  for (const row of paidRows) {
    paymentCollectedTotal += val(row.payAmount);
    if (!row.payMethod) continue; // legacy: `paymethod neq ""`
    const key = relabelPaymentMethod(row.payMethod);
    paymentCollectedMap.set(key, (paymentCollectedMap.get(key) ?? 0) + val(row.payAmount));
  }
  const paymentCollected = Array.from(paymentCollectedMap, ([key, amount]) => ({ key, amount }));

  // --- Remain Payment ------------------------------------------------------------------------
  const remainBuckets: Record<string, number> = { 'USA Customer': 0, 'GEO Customer': 0, Unknown: 0, Linoli: 0 };
  let remainPaymentTotal = 0;
  const seenRemainParcelIds = new Set<string>();
  for (const row of remainRows) {
    if (seenRemainParcelIds.has(row.parcelId)) continue;
    seenRemainParcelIds.add(row.parcelId);

    const { debt, payAmount1, payAmount2, userId } = row.parcel;
    if (debt === null) continue; // legacy: `debt neq ""`
    let d = Number(debt);
    if (payAmount2 !== null) d -= Number(payAmount2);
    if (payAmount1 !== null) d -= Number(payAmount1);

    remainPaymentTotal += d;
    if (userId === UNKNOWN_CUSTOMER_ID) remainBuckets.Unknown += d;
    else if (userId === LINOLI_CUSTOMER_ID) remainBuckets.Linoli += d;
    else {
      const country = row.parcel.user.billingAddress?.country;
      if (country === 'US') remainBuckets['USA Customer'] += d;
      else if (country === 'GE') remainBuckets['GEO Customer'] += d;
    }
  }
  const remainPayment = ['USA Customer', 'GEO Customer', 'Unknown', 'Linoli'].map((key) => ({
    key,
    amount: remainBuckets[key],
  }));

  // --- Colected In USA / Colected In Georgia -------------------------------------------------
  // Per-admin attribution over the same payment events — **not** deduped by parcel, and
  // summing the parcel's current `payAmount1` rather than the event's own `payAmount`. Both
  // are legacy's own choices.
  //
  // ⚠️ Legacy bug reproduced verbatim (docs/findings.md): the `updaterCountry eq "GE"` arm
  // credits the amount to the **Georgia** per-person table but adds it to the **USA** total.
  // Only the two username-list arms and the `US` arm agree with their own totals. The result
  // is that the Georgia table's rows do not sum to the Georgia total and the USA total is
  // inflated — reproduced as-is, because these figures are used to reconcile cash and a
  // silent correction here would be a real financial discrepancy against the old system.
  const collectedUsMap = new Map<string, number>();
  const collectedGeMap = new Map<string, number>();
  let collectedUsTotal = 0;
  let collectedGeTotal = 0;

  const add = (map: Map<string, number>, key: string, amount: number) =>
    map.set(key, (map.get(key) ?? 0) + amount);

  for (const row of paidRows) {
    if (!row.updater) continue; // no updater → legacy's `k` is blank and no branch matches
    const username = row.updater.username;
    const key = formatUpdaterName(row.updater);
    const amount = val(row.parcel.payAmount1);
    const country = row.updater.billingAddress?.country;

    if (listFindNoCase(BEMA_GE_USERNAMES, username)) {
      add(collectedGeMap, key, amount);
      collectedGeTotal += amount;
    } else if (listFindNoCase(BEMA_US_USERNAMES, username)) {
      add(collectedUsMap, key, amount);
      collectedUsTotal += amount;
    } else if (country === 'GE') {
      add(collectedGeMap, key, amount);
      collectedUsTotal += amount; // ⚠️ legacy bug — see the comment above. Not a typo here.
    } else if (country === 'US') {
      add(collectedUsMap, key, amount);
      collectedUsTotal += amount;
    }
  }

  // --- History tab ----------------------------------------------------------------------------
  const history: HistoryRow[] = historyRows.map((row) => ({
    id: row.id,
    editDateTime: row.editDateTime.toISOString(),
    editStatus: row.editStatus,
    oldValue: row.oldValue,
    newValue: row.newValue,
    valueName: row.valueName,
    payMethod: row.payMethod,
    payAmount: row.payAmount === null ? null : Number(row.payAmount),
  }));

  return {
    transactions,
    transactionsTotals,
    totalSale,
    paymentCollected,
    paymentCollectedTotal,
    remainPayment,
    remainPaymentTotal,
    collectedUs: Array.from(collectedUsMap, ([key, amount]) => ({ key, amount })),
    collectedUsTotal,
    collectedGe: Array.from(collectedGeMap, ([key, amount]) => ({ key, amount })),
    collectedGeTotal,
    history,
  };
}
