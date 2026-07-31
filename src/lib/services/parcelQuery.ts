import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import type { ListParcelsQuery } from '@/lib/validation/parcelSchema';
import type { ParcelListItem } from '@/lib/parcels/types';

// Everything that turns the bema parcels list's filter set into a Prisma query, ported from
// `MSSQLParcelDAO.getParcels()` (extensions/components/DAO/MSSQL/MSSQLParcelDAO.cfc:207).
// Shared by the list route and the CSV export route so the exported rows are always exactly
// the filtered rows — the legacy pair re-declared the same 300-line WHERE clause four times
// (count query, page query, and twice more inside the paging sub-selects), which is how they
// drifted apart (see the `office` note in `buildStatusFilter` below).
//
// Two conventions worth stating once:
//
// * Legacy tests milestone timestamps with `len(col) > 1` / `len(col) = 0 or is null` — a
//   string-length test on a datetime, i.e. "is it set". Those become plain `not: null` /
//   `null` here; the schema's own doc comment already flags confirming the NULL-vs-sentinel
//   assumption during the ETL backfill.
// * Date-only filters (Trip Date, Received Date, Status Date, the From/To range) are resolved
//   against UTC day boundaries. Legacy compared naive MSSQL `datetime`s with no zone at all,
//   so there is no legacy behavior to match here; UTC is the deterministic choice.

/** Address field mapping, legacy `addressbook.PhoneN` → this schema's named phone columns.
 *  Derived from the legacy CSV export's own headers (`PHONE`, `PHONE2`, `PRIVATE NUMBER`
 *  against `ReceiverPhone1/2/3` in bema/parcels/parcels.cfm) — Phone3 is the private number,
 *  so Phone1/Phone2 are the two contact numbers. */
export const PHONE1 = 'cellPhone';
export const PHONE2 = 'homePhone';
export const PHONE3 = 'privateNumber';

function dayRange(date: string): { gte: Date; lt: Date } {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { gte: start, lt: end };
}

function atTime(date: string, hour: number, minute: number): Date {
  return new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`);
}

/** The set-milestone/unset-milestone waterfall behind the main "Status:" filter. */
const MILESTONE_BY_STATUS = {
  delivered: 'trackingDeliveredSigned',
  outdelivery: 'trackingOutDelivery',
  region: 'trackingSendRegion',
  office: 'trackingOffice',
  processingCustom: 'trackingProcessingCustom',
  custom: 'trackingCustom',
  Delay: 'trackingDelay',
  shipped: 'trackingShipped',
  received: 'trackingReceived',
  awaiting: 'trackingAway',
} as const satisfies Record<string, keyof Prisma.ParcelWhereInput>;

/** Milestones that must be *unset* for each status — i.e. "is currently at this stage, and
 *  hasn't moved past it". Transcribed literally from the legacy chain, including its
 *  omissions: `delivered` excludes nothing (it is the terminal state), and `outdelivery`/
 *  `region` only exclude `delivered` rather than each other. */
const MUST_BE_UNSET: Record<keyof typeof MILESTONE_BY_STATUS, (keyof typeof MILESTONE_BY_STATUS)[]> = {
  delivered: [],
  outdelivery: ['delivered'],
  region: ['delivered'],
  // The legacy count query and page query disagree here: only the page query also excludes
  // `region`. Following the page query (the one that produced the rows an operator actually
  // saw), so the count and the rows finally agree.
  office: ['region', 'outdelivery', 'delivered'],
  processingCustom: ['office', 'outdelivery', 'delivered'],
  custom: ['office', 'outdelivery', 'delivered'],
  Delay: ['custom', 'office', 'outdelivery', 'delivered'],
  shipped: ['Delay', 'custom', 'office', 'outdelivery', 'delivered'],
  received: ['shipped', 'Delay', 'custom', 'office', 'outdelivery', 'delivered'],
  awaiting: ['received', 'shipped', 'Delay', 'custom', 'office', 'outdelivery', 'delivered'],
};

function buildStatusFilter(status: string, statusDate: string): Prisma.ParcelWhereInput | null {
  if (!status) return null;

  // Hold state. Legacy re-derives it inline as a data-quality predicate ("no store, or no
  // value, or no contents, and shipped after 2017-04-15, excluding one hard-coded account")
  // — the exact expression a batch job then wrote into `bOnHold`. This schema keeps that as
  // the maintained `status` column, so the filter reads the answer instead of recomputing it.
  if (status.toLowerCase() === 'onhold') return { status: 'OnHold' };

  // Three of the dropdown's options are dead in legacy: `NotOnHold`, `processingCustom` and
  // `paid` have no branch in `getParcels()`'s status chain, so picking them silently returns
  // an unfiltered list. Implemented for real here — a filter that does nothing is a bug, not
  // a behavior worth reproducing.
  if (status.toLowerCase() === 'notonhold') return { status: 'NotOnHold' };
  if (status === 'paid') return { isPaid: true };

  const key = (Object.keys(MILESTONE_BY_STATUS) as (keyof typeof MILESTONE_BY_STATUS)[]).find(
    (k) => k.toLowerCase() === status.toLowerCase(),
  );
  if (!key) return null;

  const column = MILESTONE_BY_STATUS[key];
  const where: Prisma.ParcelWhereInput = {
    [column]: statusDate ? dayRange(statusDate) : { not: null },
  };
  for (const unset of MUST_BE_UNSET[key]) {
    Object.assign(where, { [MILESTONE_BY_STATUS[unset]]: null });
  }
  return where;
}

/** The "extra search" form: a milestone within a From/To instant range, with no
 *  has-not-moved-past-it exclusions. */
function buildExtraStatusFilter(query: ListParcelsQuery): Prisma.ParcelWhereInput | null {
  const { extraStatus, fromDate, fromHour, fromMinute, toDate, toHour, toMinute } = query;
  if (!extraStatus) return null;

  const key = (Object.keys(MILESTONE_BY_STATUS) as (keyof typeof MILESTONE_BY_STATUS)[]).find(
    (k) => k.toLowerCase() === extraStatus.toLowerCase(),
  );
  if (!key) return null;

  const range: Prisma.DateTimeNullableFilter = { not: null };
  if (fromDate) range.gte = atTime(fromDate, fromHour, fromMinute);
  if (toDate) range.lt = atTime(toDate, toHour, toMinute);
  return { [MILESTONE_BY_STATUS[key]]: range };
}

function buildServiceFilter(service: string): Prisma.ParcelWhereInput | null {
  if (!service) return null;
  if (service === 'NotDeclared') return { OR: [{ value: 0 }, { value: null }] };
  // `d|X` filters on the tracking number's leading letter (D = delivery, P = pickup,
  // R = region), `p|X` on the parcel type, anything else on the service itself.
  if (service.startsWith('d|')) return { trackingNum: { startsWith: service.slice(2) } };
  if (service.startsWith('p|')) return { parcelType: service.slice(2) };
  return { service };
}

/** Space-delimited AND-of-ORs, the legacy keyword-search shape: every term must match
 *  somewhere, but each term may match any of the searchable columns.
 *
 *  Those columns live on two tables (the parcel's own tracking numbers/AWB/"additional"
 *  names, and its receiver's name/organization/city/state/phone), and an OR spanning two
 *  tables cannot use an index on either — the planner has to walk `parcels` and join out per
 *  row. At 1M parcels that measured 1.1-2.9s. `parcels.search_text` is those same columns
 *  denormalised into one trigger-maintained column with a GIN trigram index (see the
 *  20260731210000 migration), which turns the same search into a single-table indexed lookup
 *  at 3ms. Lower-cased on both sides, so a plain `contains` is already case-insensitive —
 *  `mode: 'insensitive'` would force `lower(search_text)` and lose the index.
 *
 *  Legacy searched tracking numbers on `right(keyword, 12)` — pasting a long carrier
 *  reference still finds the parcel by its trailing digits. That trailing-substring match is
 *  subsumed here: `%term%` against the same text already matches any substring. */
function buildSearchFilter(search: string): Prisma.ParcelWhereInput[] {
  return search
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => ({ searchText: { contains: term.toLowerCase() } }));
}

/** The sender filter: the same AND-of-ORs, against the *sender's* own billing address, plus
 *  an exact username match (what the group header's "All parcels" link relies on).
 *
 *  The OR sits **inside** the `user` relation filter rather than being six parcel-level
 *  conditions OR-ed together, and that structure is the whole point: written the other way
 *  Prisma emits one correlated subquery per branch and the search took 5.5s at 1M parcels;
 *  written this way it emits a single `user_id IN (SELECT ... FROM users LEFT JOIN
 *  addressbook ...)` over the 20k-row `users` table — 50ms. Same results, one subquery.
 *
 *  `parcels.search_text` is not reused here because it deliberately covers the *receiver*;
 *  senders are few enough that filtering them directly is already cheap. */
function buildSenderFilter(sender: string): Prisma.ParcelWhereInput[] {
  return sender
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => ({
      user: {
        OR: [
          { billingAddress: { organization: { contains: term, mode: 'insensitive' as const } } },
          { billingAddress: { firstName: { contains: term, mode: 'insensitive' as const } } },
          { billingAddress: { lastName: { contains: term, mode: 'insensitive' as const } } },
          { billingAddress: { [PHONE1]: { contains: term, mode: 'insensitive' as const } } },
          { billingAddress: { city: { contains: term, mode: 'insensitive' as const } } },
          { username: term },
        ],
      },
    }));
}

export function buildParcelWhere(query: ListParcelsQuery): Prisma.ParcelWhereInput {
  const and: Prisma.ParcelWhereInput[] = [];

  // Delivery-request rows are bookkeeping duplicates of a real parcel (legacy prefixes their
  // tracking number with `DR-`); the list never shows them.
  and.push({ isDr: false });

  // Searching by keyword *and* sender at once is the slowest combination in the legacy app,
  // so it caps itself at parcels received since 2020 (or not yet received at all).
  if (query.search && query.sender) {
    and.push({ OR: [{ trackingReceived: null }, { trackingReceived: { gt: new Date('2020-01-01T00:00:00.000Z') } }] });
  }

  and.push(...buildSearchFilter(query.search));
  and.push(...buildSenderFilter(query.sender));

  const statusFilter = buildStatusFilter(query.status, query.statusDate);
  if (statusFilter) and.push(statusFilter);

  const extraStatusFilter = buildExtraStatusFilter(query);
  if (extraStatusFilter) and.push(extraStatusFilter);

  const serviceFilter = buildServiceFilter(query.service);
  if (serviceFilter) and.push(serviceFilter);

  if (query.userId) and.push({ userId: query.userId });
  if (query.receivedBy) and.push({ trackingReceivedBy: query.receivedBy });
  if (query.tripDate) and.push({ tripDate: dayRange(query.tripDate) });
  if (query.receivedDate) and.push({ trackingReceived: dayRange(query.receivedDate) });

  // Legacy coerces the free-text Group field with `int(val(x))`, so a non-numeric entry
  // becomes group 0 rather than an error. Kept, since operators do type bare numbers here.
  if (query.groupId) and.push({ groupId: String(parseInt(query.groupId, 10) || 0) });

  if (query.city === '1') and.push({ receiver: { address: { city: 'Tbilisi' } } });
  if (query.city === '2') {
    // SQL `<>` never matches NULL, so "Not Tbilisi" excluded receivers with no city at all.
    and.push({ receiver: { address: { AND: [{ city: { not: null } }, { city: { not: 'Tbilisi' } }] } } });
  }

  // The Debt box is a *not-equal* filter on uninvoiced parcels, except for the value `0`,
  // which means "has a debt figure at all". Unintuitive, but it is what the box does, and
  // operators use it to pull the parcels whose debt was mis-keyed away from an expected
  // amount. `debt` alone never restricts to invoiced parcels.
  if (query.debt === '0') and.push({ debt: { not: null }, isInvoiced: false });
  else if (query.debt) and.push({ debt: { not: Number(query.debt) || 0 }, isInvoiced: false });

  // "Paid" here means "has been invoiced, or was free" — not the `bPaidDelivery` flag.
  if (query.isPaid === 'Y') and.push({ OR: [{ isInvoiced: true }, { debt: null }, { debt: 0 }] });
  if (query.isPaid === 'N') and.push({ isInvoiced: false, debt: { gt: 0 } });

  // `del=1`: in the Tbilisi office, delivery not yet paid for, and not already a delivery or
  // region parcel — i.e. the ones still waiting for a delivery request.
  if (query.deliveryPending === '1') {
    and.push({
      trackingDeliveredSigned: null,
      trackingOutDelivery: null,
      trackingOffice: { not: null },
      bPaidDelivery: false,
      NOT: [{ trackingNum: { startsWith: 'D' } }, { trackingNum: { startsWith: 'R' } }],
    });
  }

  // `delreq=1`: the Delivery Request queue — in the office, delivery paid for (or a D-/R-
  // prefixed tracking number), not yet delivered, and either not yet out for delivery or
  // already assigned to an admin.
  if (query.deliveryRequest === '1') {
    and.push({
      trackingDeliveredSigned: null,
      trackingOffice: { not: null },
      OR: [{ trackingOutDelivery: null }, { AND: [{ trackingOutDelivery: { not: null } }, { buser: { not: null } }] }],
      AND: [
        {
          OR: [
            { bPaidDelivery: true },
            { trackingNum: { startsWith: 'D' } },
            {
              AND: [
                { trackingNum: { startsWith: 'R' } },
                { NOT: { trackingNum: { endsWith: 'PL' } } },
                { NOT: { trackingNum: { endsWith: 'CN' } } },
              ],
            },
          ],
        },
      ],
    });
  }

  return { AND: and };
}

const SORT_COLUMNS = {
  Created: 'created',
  TripDate: 'tripDate',
  TrackingNum: 'trackingNum',
  TrackingNum2: 'trackingNum2',
} as const;

export function buildParcelOrderBy(
  sort: ListParcelsQuery['sort'],
  dir: ListParcelsQuery['dir'],
): Prisma.ParcelOrderByWithRelationInput[] {
  // `id` last so a page boundary can't drop or repeat a row when many parcels share the
  // same timestamp — the legacy `row_number() over (order by …)` paging had no tiebreaker
  // and could do exactly that.
  return [{ [SORT_COLUMNS[sort]]: dir }, { id: 'asc' }];
}

// The filters the legacy screen counts as "the operator has actually searched for
// something". If none are set, it silently scopes the list to parcels the current admin
// received (`url.eadmin = session.buser.getUserID()`), which is what makes the unfiltered
// first page useful instead of "every parcel ever". Note `service`, `sort` and paging are
// not in the list — same as legacy.
const MEANINGFUL_FILTERS = [
  'search',
  'sender',
  'city',
  'debt',
  'groupId',
  'isPaid',
  'status',
  'statusDate',
  'receivedDate',
  'tripDate',
  'userId',
  'extraStatus',
  'fromDate',
  'toDate',
] as const satisfies readonly (keyof ListParcelsQuery)[];

export function hasMeaningfulFilter(query: ListParcelsQuery): boolean {
  return MEANINGFUL_FILTERS.some((key) => query[key] !== '' && query[key] !== undefined);
}

// --- Row shaping -------------------------------------------------------------------------

export const PARCEL_LIST_INCLUDE = {
  user: {
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      balanceAdjust: true,
      balance: { select: { paidAmount: true, invoiceAmount: true } },
    },
  },
  receiver: { select: { address: true } },
} satisfies Prisma.ParcelInclude;

type ParcelRow = Prisma.ParcelGetPayload<{ include: typeof PARCEL_LIST_INCLUDE }>;

const num = (value: Prisma.Decimal | null) => (value === null ? null : Number(value));
const iso = (value: Date | null) => (value === null ? null : value.toISOString());

export function toParcelListItem(row: ParcelRow, adminNames: Map<string, AdminName>): ParcelListItem {
  const address = row.receiver?.address ?? null;

  return {
    id: row.id,
    trackingNum: row.trackingNum,
    trackingNum2: row.trackingNum2,
    awb: row.awb,
    pcode: row.pcode,
    groupId: row.groupId,
    service: row.service,
    parcelType: row.parcelType,
    contents: row.contents,
    notes: row.notes,
    location: row.location,
    officeName: row.officeName,
    store: row.store,

    created: row.created.toISOString(),
    tripDate: iso(row.tripDate),

    weight: num(row.weight),
    value: num(row.value),
    debt: num(row.debt),
    length: num(row.length),
    width: num(row.width),
    high: num(row.high),
    dimWeight: num(row.dimWeight),

    status: row.status,
    isPaid: row.isPaid,
    isInvoiced: row.isInvoiced,
    invoiceId: row.invoiceId,
    topFlag: row.topFlag,
    bPaidDelivery: row.bPaidDelivery,

    payMethod1: row.payMethod1,
    payMethod2: row.payMethod2,
    payAmount1: num(row.payAmount1),
    payAmount2: num(row.payAmount2),
    onlineSource: row.onlineSource,

    additionalUsername: row.additionalUsername,
    additionalFirstname: row.additionalFirstname,
    additionalLastname: row.additionalLastname,
    buser: row.buser,
    buserName: row.buser ? (adminNames.get(row.buser)?.display ?? null) : null,

    trackingAway: iso(row.trackingAway),
    trackingReceived: iso(row.trackingReceived),
    trackingEstDelivery: iso(row.trackingEstDelivery),
    trackingEstShip: iso(row.trackingEstShip),
    trackingShipped: iso(row.trackingShipped),
    trackingDelay: iso(row.trackingDelay),
    trackingCustom: iso(row.trackingCustom),
    trackingProcessingCustom: iso(row.trackingProcessingCustom),
    trackingOffice: iso(row.trackingOffice),
    trackingOutDelivery: iso(row.trackingOutDelivery),
    trackingSendRegion: iso(row.trackingSendRegion),
    trackingDeliveredSigned: iso(row.trackingDeliveredSigned),

    user: {
      id: row.user.id,
      username: row.user.username,
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      // The legacy header recomputed this per row as `paidamount − invoiceamount +
      // balanceadjust` from two correlated subqueries; `user_balances` is the maintained
      // aggregate that replaced them.
      balance:
        Number(row.user.balance?.paidAmount ?? 0) -
        Number(row.user.balance?.invoiceAmount ?? 0) +
        Number(row.user.balanceAdjust ?? 0),
    },

    receiver: address
      ? {
          firstName: address.firstName,
          lastName: address.lastName,
          firstNameGe: address.firstNameGe,
          lastNameGe: address.lastNameGe,
          organization: address.organization,
          street1: address.street1,
          street2: address.street2,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country,
          phone1: address[PHONE1],
          phone2: address[PHONE2],
          phone3: address[PHONE3],
        }
      : null,

    receivedByName: row.trackingReceivedBy ? (adminNames.get(row.trackingReceivedBy)?.display ?? null) : null,
  };
}

export type AdminName = { firstName: string; lastName: string; display: string };

/** Resolves the `trackingReceivedBy`/`buser` admin ids on a page of rows to names in one
 *  query — legacy ran two correlated subqueries per row for the same two names. First/last
 *  are kept separate because the CSV export has a column for each. */
export async function loadAdminNames(
  rows: { trackingReceivedBy: string | null; buser: string | null }[],
): Promise<Map<string, AdminName>> {
  const ids = [...new Set(rows.flatMap((r) => [r.trackingReceivedBy, r.buser]).filter((v): v is string => !!v))];
  if (ids.length === 0) return new Map();

  const admins = await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, firstName: true, lastName: true, username: true },
  });
  return new Map(
    admins.map((a) => {
      const firstName = a.firstName ?? '';
      const lastName = a.lastName ?? '';
      return [a.id, { firstName, lastName, display: `${firstName} ${lastName}`.trim() || a.username }];
    }),
  );
}
