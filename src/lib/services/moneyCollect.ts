import { db } from '@/lib/db';

// "Money collect" — legacy `bema/parcels/money-collect.cfm` + `views/parcels/vwMoneyCollect.cfm`
// (report) and `bema/ajax/moneyCollect.cfm` (the password-gated "Collect Money" write action).
//
// Not ported: legacy's `cgi.request_method eq "POST"` branch first runs an INSERT that
// backfills `parcelhistory` "Paid" events from online `payments`/`invoices`/`invoices_items`
// rows that have never had *any* non-blank `paymethod` history row
// (`ii.ParcelId not in (select parcelid from parcelhistory where paymethod is not null and
// paymethod != '')`), joining `payments` to `invoices` via `i.transactionid = p.transactionid`.
// The redesigned schema (docs/migrations/04-postgres-schema-design.md) has no `transactionId`
// column on either `Payment` or `Invoice` — `Payment` only carries `userId`/`paymentDate`/
// `amount`/`paymentMethodId`, correlated to `Invoice` only loosely via the owning user, not a
// per-transaction key. There is no way to reproduce this backfill's join in the new schema at
// all, so it is not implemented — see docs/findings.md.
//
// Three-valued-SQL trap this port had to reproduce (same mechanism as the sibling "Parcels
// Reports 2" report, see parcelSalesReport.ts's header comment): `ph.updaterID NOT IN
// ('26259424-...')` also drops every row whose `updaterId` is NULL. Prisma's bare
// `updaterId: { not: EXCLUDED_AGENT_ID }` reproduces this automatically (NULL propagates
// through `<>` the same way), so no special-casing is needed here either.
//
// Legacy wraps `valuename`/`payMethod` in `LOWER(...)`; this app's own writers only ever
// produce the exact casings `'Paid'`/`'Unpaid'`/`'Debt'`, so an exact-case match is used here,
// the same established simplification as the sibling reports (see docs/findings.md).

const EXCLUDED_AGENT_ID = '26259424-F3BB-ABC7-6C6C159A66E573A9';

export type MoneyCollectRange = { start: Date; end: Date };

export type MoneyBuckets = {
  cash: number;
  creditCard: number;
  creditCardGe: number;
  bankDeposit: number;
  wireTransfer: number;
  check: number;
  paypal: number;
  authorize: number;
};

function emptyBuckets(): MoneyBuckets {
  return {
    cash: 0,
    creditCard: 0,
    creditCardGe: 0,
    bankDeposit: 0,
    wireTransfer: 0,
    check: 0,
    paypal: 0,
    authorize: 0,
  };
}

/** Legacy's `findNoCase()` chain over `#totals#`'s keys (`vwMoneyCollect.cfm`) — a
 *  case-insensitive *substring* match, first-match-wins, in this exact order. "Card GE" is
 *  checked before the bare "Card" bucket specifically because a "CreditCard GE" method string
 *  would otherwise match "Card" first. A method matching none of these (e.g. a bare "Wire"-less
 *  custom string) contributes to the group `total` but no bucket, same as legacy. */
export function bucketPayMethod(rawPayMethod: string): keyof MoneyBuckets | null {
  const m = rawPayMethod.toLowerCase();
  if (m.includes('cash')) return 'cash';
  if (m.includes('deposit')) return 'bankDeposit';
  if (m.includes('card ge')) return 'creditCardGe';
  if (m.includes('card')) return 'creditCard';
  if (m.includes('check')) return 'check';
  if (m.includes('authorize')) return 'authorize';
  if (m.includes('paypal')) return 'paypal';
  if (m.includes('wire')) return 'wireTransfer';
  return null;
}

export type GroupHistoryRow = { valueName: string | null; payMethod: string | null; payAmount: number };

export type GroupTotals = { buckets: MoneyBuckets; total: number };

/** Legacy's per-(agent, day) totals loop. A row matched into the group only via the parcel's
 *  `payMethod1 LIKE '%PayPal%'/'%Authorize%'` OR-branch, but whose own `valueName` isn't
 *  "Paid"/"Unpaid", contributes to neither `total` nor any bucket — legacy's inner `<cfif>`
 *  chain has no `else` branch, so such a row is silently a no-op here too. */
export function accumulateGroupTotals(rows: GroupHistoryRow[]): GroupTotals {
  const buckets = emptyBuckets();
  let total = 0;
  for (const row of rows) {
    const v = row.valueName?.toLowerCase();
    let signed: number;
    if (v === 'paid') signed = row.payAmount;
    else if (v === 'unpaid') signed = -row.payAmount;
    else continue;

    total += signed;
    const bucket = row.payMethod ? bucketPayMethod(row.payMethod) : null;
    if (bucket) buckets[bucket] += signed;
  }
  return { buckets, total };
}

export type MoneyCollectGroupRow = {
  updaterId: string;
  /** Same value as `updaterId` — kept as its own field since it's what the "Collect Money"
   *  write action actually needs (legacy's hidden `#userid#` field). */
  userId: string;
  updaterUsername: string | null;
  /** The link text / row label: the resolved account's bare username, or legacy's
   *  denormalized free-text `ph.updater` when no account matched. */
  updaterDisplayName: string;
  /** UTC calendar day of `editDateTime` — legacy's `convert(varchar, ph.editdatetime, 104)`
   *  grouping key, and this report's own `MoneyCollectHistory.cDate` day-match key. */
  dateKey: string;
  cash: number;
  creditCard: number;
  creditCardGe: number;
  bankDeposit: number;
  wireTransfer: number;
  check: number;
  paypal: number;
  authorize: number;
  total: number;
  /** `null` when no `MoneyCollectHistory` row matches this (agent, day) yet — legacy's
   *  `collected eq ""`, the condition that shows the collect radio button instead of the
   *  already-collected amount + Detail link. */
  collected: number | null;
  aCash: number | null;
  aCreditCard: number | null;
  aBankDeposit: number | null;
  aWireTransfer: number | null;
  /** `null` if the stored `collectorUsername` doesn't resolve to a real account (legacy's
   *  `LEFT JOIN users collector ON mch.collectorId = collector.username`). */
  collectorUsername: string | null;
  gDate: string | null;
};

export type BemaManagerOption = { username: string; firstName: string | null; lastName: string | null };

export type MoneyCollectReport = {
  groups: MoneyCollectGroupRow[];
  /** Legacy `userDAO.getUsers(typeId=1)` called with no `active` argument — `active` defaults
   *  to `""` there, so its `<cfif arguments.active neq "">` guard never adds the filter and
   *  **inactive** BEMA accounts are listed in the "Manager" select too, unlike the sibling
   *  reports' `bemaUsers` (which do filter `active=1`). Kept faithful rather than "fixed". */
  managers: BemaManagerOption[];
};

export async function getMoneyCollectReport(
  range: MoneyCollectRange,
  country?: 'us' | 'ge',
): Promise<MoneyCollectReport> {
  const historyRows = await db.parcelHistory.findMany({
    where: {
      editDateTime: { gt: range.start, lte: range.end },
      payMethod: { not: 'Debt' },
      updaterId: { not: EXCLUDED_AGENT_ID },
      OR: [
        { valueName: { in: ['Paid', 'Unpaid'] } },
        { parcel: { payMethod1: { contains: 'PayPal' } } },
        { parcel: { payMethod1: { contains: 'Authorize' } } },
      ],
      ...(country ? { updater: { billingAddress: { country: country.toUpperCase() } } } : {}),
    },
    select: {
      payAmount: true,
      payMethod: true,
      valueName: true,
      editDateTime: true,
      updaterId: true,
      updaterName: true,
      updater: { select: { id: true, username: true } },
    },
    orderBy: [{ updaterId: 'asc' }, { editDateTime: 'asc' }],
  });

  type GroupAccumulator = {
    updaterId: string;
    updaterUsername: string | null;
    updaterDisplayName: string;
    dateKey: string;
    rows: GroupHistoryRow[];
  };
  const groupsByKey = new Map<string, GroupAccumulator>();
  for (const row of historyRows) {
    // `updaterId: { not: EXCLUDED_AGENT_ID }` above already excludes NULL (see file header),
    // so `updaterId` is guaranteed non-null past this point.
    const updaterId = row.updaterId as string;
    const dateKey = row.editDateTime.toISOString().slice(0, 10);
    const key = `${updaterId}|${dateKey}`;
    let group = groupsByKey.get(key);
    if (!group) {
      group = {
        updaterId,
        updaterUsername: row.updater?.username ?? null,
        updaterDisplayName: row.updater?.username ?? row.updaterName ?? '',
        dateKey,
        rows: [],
      };
      groupsByKey.set(key, group);
    }
    group.rows.push({
      valueName: row.valueName,
      payMethod: row.payMethod,
      payAmount: row.payAmount == null ? 0 : Number(row.payAmount),
    });
  }

  const updaterIds = Array.from(groupsByKey.values()).map((g) => g.updaterId);
  const mchRows =
    updaterIds.length === 0
      ? []
      : await db.moneyCollectHistory.findMany({
          where: { userId: { in: updaterIds } },
          select: {
            userId: true,
            cDate: true,
            aCash: true,
            aCreditCard: true,
            aBankDeposit: true,
            aWireTransfer: true,
            collected: true,
            collectorUsername: true,
            gDate: true,
          },
        });
  const mchByKey = new Map<string, (typeof mchRows)[number]>();
  for (const m of mchRows) {
    mchByKey.set(`${m.userId}|${m.cDate.toISOString().slice(0, 10)}`, m);
  }

  const collectorUsernames = Array.from(new Set(mchRows.map((m) => m.collectorUsername)));
  const validCollectors =
    collectorUsernames.length === 0
      ? new Set<string>()
      : new Set(
          (
            await db.user.findMany({
              where: { username: { in: collectorUsernames } },
              select: { username: true },
            })
          ).map((u) => u.username),
        );

  const groups: MoneyCollectGroupRow[] = Array.from(groupsByKey.values()).map((group) => {
    const { buckets, total } = accumulateGroupTotals(group.rows);
    const mch = mchByKey.get(`${group.updaterId}|${group.dateKey}`);
    return {
      updaterId: group.updaterId,
      userId: group.updaterId,
      updaterUsername: group.updaterUsername,
      updaterDisplayName: group.updaterDisplayName,
      dateKey: group.dateKey,
      cash: buckets.cash,
      creditCard: buckets.creditCard,
      creditCardGe: buckets.creditCardGe,
      bankDeposit: buckets.bankDeposit,
      wireTransfer: buckets.wireTransfer,
      check: buckets.check,
      paypal: buckets.paypal,
      authorize: buckets.authorize,
      total,
      collected: mch ? Number(mch.collected) : null,
      aCash: mch ? Number(mch.aCash) : null,
      aCreditCard: mch ? Number(mch.aCreditCard) : null,
      aBankDeposit: mch ? Number(mch.aBankDeposit) : null,
      aWireTransfer: mch ? Number(mch.aWireTransfer) : null,
      collectorUsername: mch && validCollectors.has(mch.collectorUsername) ? mch.collectorUsername : null,
      gDate: mch ? mch.gDate.toISOString() : null,
    };
  });

  const managers = await db.user.findMany({
    where: { accountType: 'BemaUser' },
    select: { username: true, firstName: true, lastName: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  return { groups, managers };
}

export type CollectMoneyInput = {
  userId: string;
  /** `YYYY-MM-DD` — the group's `dateKey`, stored as that day's UTC midnight. */
  cDate: string;
  aCash: number;
  aCreditCard: number;
  aBankDeposit: number;
  aWireTransfer: number;
  collected: number;
  collectorUsername: string;
  /** `YYYY-MM-DD` — legacy's manager-editable "Date" field, distinct from `cDate` (see the
   *  `MoneyCollectHistory.gDate` doc comment). */
  gDate: string;
};

/** The DB write half of `bema/ajax/moneyCollect.cfm` — the password re-auth (legacy
 *  `userDAO.validateLogin`) happens in the API route, which calls this only after that
 *  succeeds. No duplicate-collection guard, matching legacy (a second submit for the same
 *  (agent, day) just inserts a second row). */
export async function collectMoney(input: CollectMoneyInput) {
  await db.moneyCollectHistory.create({
    data: {
      userId: input.userId,
      cDate: new Date(`${input.cDate}T00:00:00.000Z`),
      aCash: input.aCash,
      aCreditCard: input.aCreditCard,
      aBankDeposit: input.aBankDeposit,
      aWireTransfer: input.aWireTransfer,
      collected: input.collected,
      collectorUsername: input.collectorUsername,
      gDate: new Date(`${input.gDate}T00:00:00.000Z`),
    },
  });
}

export async function getTodayCollectedTotal(collectorUsername: string, now = new Date()): Promise<number> {
  const dayKey = now.toISOString().slice(0, 10);
  const start = new Date(`${dayKey}T00:00:00.000Z`);
  const end = new Date(`${dayKey}T23:59:59.999Z`);
  const result = await db.moneyCollectHistory.aggregate({
    where: {
      collectorUsername,
      gDate: { gte: start, lte: end },
    },
    _sum: { collected: true },
  });
  return Number(result._sum.collected ?? 0);
}
