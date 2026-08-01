import { db } from '@/lib/db';

// "Parcels Reports" — legacy `bema/parcels/parcels-reports.cfm` + `views/parcels/
// vwParcelsReports.cfm`. Legacy drives every table on this screen off `ParcelHistory`, a
// generic append-only edit log (one row per field change, carrying `EditStatus`/`OldValue`/
// `NewValue`/`ValueName`/`PayMethod`/`PayAmount`/`updaterID`) that this schema deliberately
// does not have an equivalent of — see docs/migrations/04-postgres-schema-design.md §1
// ("a real audit trail — something the legacy system lacks outside the write-only
// `operations` table"), which replaced it with `parcel_status_history` (status transitions
// only, no old/new diff, no payment info, no "who") plus `invoices`/`invoices_items`/
// `payments` for money. This is a genuine, already-made architecture decision from an
// earlier phase of this project, not something this file can route around — see
// docs/findings.md's "Parcels Reports" entry for the full trace of what could and couldn't
// be reconstructed from the current schema, and what's still open.
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
  editDateTime: string;
};

export const TOTAL_SALE_KEYS = ['Express', 'Regular', 'Cargo', 'Linoli', 'Unknown'] as const;
type TotalSaleKey = (typeof TOTAL_SALE_KEYS)[number];
export type TotalSaleBuckets = Record<TotalSaleKey | 'Total', { weight: number; cost: number }>;

export type KeyedAmount = { key: string; amount: number };

export type StatusHistoryRow = {
  id: string;
  changedAt: string;
  status: string;
  changedBy: string | null;
};

export type ParcelsReportResult = {
  transactions: PaidTransactionRow[];
  transactionsTotals: { weight: number; payAmount: number; debt: number };
  totalSale: TotalSaleBuckets;
  paymentCollected: KeyedAmount[];
  paymentCollectedTotal: number;
  // Fixed key order/set, matching legacy's pre-seeded struct — always present even at 0,
  // since the legacy layout always shows all four rows. "Unknown"/"Linoli" (legacy's two
  // hardcoded placeholder-customer GUIDs) can never be populated here: no legacy customer
  // data has been imported yet (ETL not started), so those ids don't exist in this schema —
  // see docs/findings.md.
  remainPayment: KeyedAmount[];
  remainPaymentTotal: number;
  statusHistory: StatusHistoryRow[];
};

const DEBT_PAYMETHOD2_VARIANTS = new Set(['Dept', 'Depth', 'Debt']);

function relabelPaymentMethod(payMethod: string): string {
  // Ported verbatim from vwParcelsReports.cfm's `PaymentColectedKey` remap — including the
  // "CreditCard GEO" comparison, which never actually matches any value this app's
  // `payMethod1` field can hold (the real GE credit-card value is "CreditCard GE", see
  // docs/findings.md); kept anyway since it's cheap and matches legacy's own current
  // (also-dead) behavior.
  if (payMethod === 'CreditCard GEO') return 'Credit Card GE';
  if (payMethod === 'CreditCard') return 'Credit Card US';
  return payMethod;
}

export async function getParcelsReport(range: ParcelsReportRange): Promise<ParcelsReportResult> {
  const rawItems = await db.invoiceItem.findMany({
    where: { invoice: { invoiceDate: { gt: range.start, lte: range.end } } },
    include: {
      invoice: true,
      parcel: { include: { user: { include: { billingAddress: true } } } },
    },
  });

  // legacy: `p.trackingnum <> ''` — applies to every one of this page's queries.
  const items = rawItems.filter((item) => !!item.parcel.trackingNum);

  // --- "Paid transactions" tab + Total Sale + Payment Collected -------------------------
  // legacy: `ph.valuename = 'Paid' AND ph.payMethod != 'Debt'`. `ph.payamount`/`ph.paymethod`
  // are per-history-row values this schema doesn't keep; the closest available analog is the
  // invoice line's own amount and the parcel's current `payMethod1` (see docs/findings.md —
  // this can drift from the value at the moment of payment if `payMethod1` was edited since).
  const paidItems = items.filter((item) => item.parcel.payMethod1 !== 'Debt');

  const transactions: PaidTransactionRow[] = paidItems
    .map((item) => ({
      id: item.id,
      username: item.parcel.user.username,
      firstName: item.parcel.user.firstName,
      lastName: item.parcel.user.lastName,
      trackingNum: item.parcel.trackingNum ?? '',
      service: item.parcel.service,
      weight: item.parcel.weight === null ? null : Number(item.parcel.weight),
      payAmount: Number(item.amount),
      payMethod: item.parcel.payMethod1,
      debt: item.parcel.debt === null ? null : Number(item.parcel.debt),
      editDateTime: item.invoice.invoiceDate.toISOString(),
    }))
    .sort((a, b) => a.editDateTime.localeCompare(b.editDateTime));

  const transactionsTotals = transactions.reduce(
    (acc, row) => ({
      weight: acc.weight + (row.weight ?? 0),
      payAmount: acc.payAmount + (row.payAmount ?? 0),
      debt: acc.debt + (row.debt ?? 0),
    }),
    { weight: 0, payAmount: 0, debt: 0 },
  );

  // Total Sale: legacy groups `TotalSalesParcels` by `PARCELID` and reads the *current*
  // `parcels.weight`/`parcels.debt` (not a historical value) — deduped here the same way, by
  // parcel id, so a parcel paid twice inside the window isn't double-counted (see
  // docs/findings.md for why legacy's own ungrouped/unordered `cfloop group` can't be
  // reproduced faithfully here — it's non-deterministic on legacy's own DB row order).
  const totalSale = TOTAL_SALE_KEYS.reduce(
    (acc, key) => ({ ...acc, [key]: { weight: 0, cost: 0 } }),
    { Total: { weight: 0, cost: 0 } } as TotalSaleBuckets,
  );
  const seenParcelIds = new Set<string>();
  for (const item of paidItems) {
    if (seenParcelIds.has(item.parcelId)) continue;
    seenParcelIds.add(item.parcelId);

    const { weight, debt, service } = item.parcel;
    if (weight === null || debt === null) continue; // legacy: `weight neq "" && debt neq ""`
    const weightNum = Number(weight);
    const debtNum = Number(debt);

    totalSale.Total.weight += weightNum;
    totalSale.Total.cost += debtNum;

    // legacy's Unknown/Linoli branches match two hardcoded legacy customer GUIDs — unreachable
    // here (see docs/findings.md), so only the Service-based branch below can ever apply.
    if (service === 'Express' || service === 'Regular' || service === 'Cargo') {
      totalSale[service as TotalSaleKey].weight += weightNum;
      totalSale[service as TotalSaleKey].cost += debtNum;
    }
  }

  // Payment Collected: legacy sums *every* qualifying row's `payamount` into the grand total,
  // and separately buckets by (relabeled) `paymethod` for rows with a non-blank method — not
  // deduped by parcel, since each is a distinct payment event.
  const paymentCollectedMap = new Map<string, number>();
  let paymentCollectedTotal = 0;
  for (const item of paidItems) {
    const amount = Number(item.amount);
    paymentCollectedTotal += amount;
    const payMethod = item.parcel.payMethod1;
    if (!payMethod) continue;
    const key = relabelPaymentMethod(payMethod);
    paymentCollectedMap.set(key, (paymentCollectedMap.get(key) ?? 0) + amount);
  }
  const paymentCollected: KeyedAmount[] = Array.from(paymentCollectedMap, ([key, amount]) => ({ key, amount }));

  // --- Remain Payment ---------------------------------------------------------------------
  // legacy: `p.paymethod2 not in ('Dept','Depth','Debt')`, grouped by parcelid, `d = debt -
  // payAmount2 - payAmount1` (only subtracted when actually set).
  const remainItems = items.filter(
    (item) => !item.parcel.payMethod2 || !DEBT_PAYMETHOD2_VARIANTS.has(item.parcel.payMethod2),
  );
  const remainBuckets: Record<string, number> = { 'USA Customer': 0, 'GEO Customer': 0, Unknown: 0, Linoli: 0 };
  let remainPaymentTotal = 0;
  const seenRemainParcelIds = new Set<string>();
  for (const item of remainItems) {
    if (seenRemainParcelIds.has(item.parcelId)) continue;
    seenRemainParcelIds.add(item.parcelId);

    const { debt, payAmount1, payAmount2 } = item.parcel;
    if (debt === null) continue; // legacy: `debt neq ""`
    let d = Number(debt);
    if (payAmount2 !== null) d -= Number(payAmount2);
    if (payAmount1 !== null) d -= Number(payAmount1);

    remainPaymentTotal += d;
    // Unknown/Linoli hardcoded-id branches are unreachable here (see docs/findings.md);
    // only the billing-country branch below can ever apply.
    const country = item.parcel.user.billingAddress?.country;
    if (country === 'US') remainBuckets['USA Customer'] += d;
    else if (country === 'GE') remainBuckets['GEO Customer'] += d;
  }
  const remainPayment: KeyedAmount[] = ['USA Customer', 'GEO Customer', 'Unknown', 'Linoli'].map((key) => ({
    key,
    amount: remainBuckets[key],
  }));

  // --- History tab -------------------------------------------------------------------------
  // legacy's `History` query is every ParcelHistory row in range whose `EditStatus` isn't
  // `Added`/`Paid` — i.e. mostly status-transition edits — with per-row `OldValue`/`NewValue`/
  // `ValueName`/`PayMethod`/`PayAmount`. `parcel_status_history` is this schema's nearest
  // analog (status transitions only, no old/new diff, no payment fields) — see
  // docs/findings.md for the substitution and what's not reproduced.
  const statusHistoryRows = await db.parcelStatusHistory.findMany({
    where: { changedAt: { gt: range.start, lte: range.end } },
    orderBy: { changedAt: 'desc' },
  });
  const statusHistory: StatusHistoryRow[] = statusHistoryRows.map((row) => ({
    id: row.id,
    changedAt: row.changedAt.toISOString(),
    status: row.status,
    changedBy: row.changedBy,
  }));

  return {
    transactions,
    transactionsTotals,
    totalSale,
    paymentCollected,
    paymentCollectedTotal,
    remainPayment,
    remainPaymentTotal,
    statusHistory,
  };
}
