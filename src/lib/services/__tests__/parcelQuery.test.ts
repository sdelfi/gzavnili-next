import { describe, expect, test } from 'bun:test';
import { buildParcelOrderBy, buildParcelWhere, hasMeaningfulFilter } from '../parcelQuery';
import { listParcelsQuerySchema } from '@/lib/validation/parcelSchema';

// These lock down the filter semantics ported from `MSSQLParcelDAO.getParcels()`. They assert
// the *shape of the Prisma query*, not database results, on purpose: the semantics are what
// was painstakingly established against the legacy SQL, and a refactor that quietly drops an
// exclusion from a status waterfall or turns a "not equal" into an "equal" is exactly the
// regression that would otherwise only surface as an operator saying "the numbers look wrong".

const query = (params: Record<string, string> = {}) => listParcelsQuerySchema.parse(params);

/** Recursively collects the `AND` conditions the builder produced, so a test can assert one
 *  condition is present without depending on where in the tree it landed. */
function conditions(where: ReturnType<typeof buildParcelWhere>): Record<string, unknown>[] {
  return (where.AND as Record<string, unknown>[]) ?? [];
}

describe('buildParcelWhere', () => {
  test('always excludes delivery-request bookkeeping rows', () => {
    expect(conditions(buildParcelWhere(query()))).toContainEqual({ isDr: false });
  });

  test('keyword search is an AND of terms against the denormalised column, lower-cased', () => {
    const where = buildParcelWhere(query({ search: 'Beridze TBILISI' }));
    expect(conditions(where)).toContainEqual({ searchText: { contains: 'beridze' } });
    expect(conditions(where)).toContainEqual({ searchText: { contains: 'tbilisi' } });
  });

  test('search + sender together caps the range at 2020, as legacy does', () => {
    const withBoth = conditions(buildParcelWhere(query({ search: 'a', sender: 'b' })));
    const hasCap = withBoth.some(
      (c) => Array.isArray(c.OR) && (c.OR as Record<string, unknown>[]).some((o) => o.trackingReceived === null),
    );
    expect(hasCap).toBe(true);

    const searchOnly = conditions(buildParcelWhere(query({ search: 'a' })));
    expect(
      searchOnly.some(
        (c) => Array.isArray(c.OR) && (c.OR as Record<string, unknown>[]).some((o) => o.trackingReceived === null),
      ),
    ).toBe(false);
  });

  test('sender filter nests its OR inside the user relation (one subquery, not six)', () => {
    const [condition] = conditions(buildParcelWhere(query({ sender: 'Beridze' }))).filter((c) => 'user' in c);
    expect(condition).toBeDefined();
    const user = condition.user as { OR: unknown[] };
    expect(Array.isArray(user.OR)).toBe(true);
    expect(user.OR).toContainEqual({ username: 'Beridze' });
  });

  describe('status waterfall', () => {
    test('delivered matches the milestone with no exclusions — it is terminal', () => {
      const [status] = conditions(buildParcelWhere(query({ status: 'delivered' }))).filter(
        (c) => 'trackingDeliveredSigned' in c,
      );
      expect(status).toEqual({ trackingDeliveredSigned: { not: null } });
    });

    test('office excludes the three later milestones', () => {
      const [status] = conditions(buildParcelWhere(query({ status: 'office' }))).filter((c) => 'trackingOffice' in c);
      expect(status).toEqual({
        trackingOffice: { not: null },
        trackingSendRegion: null,
        trackingOutDelivery: null,
        trackingDeliveredSigned: null,
      });
    });

    test('awaiting excludes all seven later milestones', () => {
      const [status] = conditions(buildParcelWhere(query({ status: 'awaiting' }))).filter((c) => 'trackingAway' in c);
      expect(Object.keys(status).filter((k) => status[k] === null)).toHaveLength(7);
    });

    test('statusDate narrows the milestone to that calendar day (UTC)', () => {
      const [status] = conditions(buildParcelWhere(query({ status: 'delivered', statusDate: '2026-07-20' }))).filter(
        (c) => 'trackingDeliveredSigned' in c,
      );
      expect(status.trackingDeliveredSigned).toEqual({
        gte: new Date('2026-07-20T00:00:00.000Z'),
        lt: new Date('2026-07-21T00:00:00.000Z'),
      });
    });

    test('status is matched case-insensitively, as ColdFusion compared it', () => {
      expect(buildParcelWhere(query({ status: 'DELIVERED' }))).toEqual(
        buildParcelWhere(query({ status: 'delivered' })),
      );
    });

    // The three options that were dead in legacy — see docs/decisions/0015.
    test('OnHold / NotOnHold / paid read the maintained columns instead of doing nothing', () => {
      expect(conditions(buildParcelWhere(query({ status: 'OnHold' })))).toContainEqual({ status: 'OnHold' });
      expect(conditions(buildParcelWhere(query({ status: 'NotOnHold' })))).toContainEqual({ status: 'NotOnHold' });
      expect(conditions(buildParcelWhere(query({ status: 'paid' })))).toContainEqual({ isPaid: true });
    });
  });

  describe('service dropdown encodes three different meanings', () => {
    test('bare value filters the service', () => {
      expect(conditions(buildParcelWhere(query({ service: 'Express' })))).toContainEqual({ service: 'Express' });
    });
    test('d| filters the tracking-number prefix', () => {
      expect(conditions(buildParcelWhere(query({ service: 'd|R' })))).toContainEqual({
        trackingNum: { startsWith: 'R' },
      });
    });
    test('p| filters the parcel type', () => {
      expect(conditions(buildParcelWhere(query({ service: 'p|Online' })))).toContainEqual({ parcelType: 'Online' });
    });
    test('NotDeclared means no declared value', () => {
      expect(conditions(buildParcelWhere(query({ service: 'NotDeclared' })))).toContainEqual({
        OR: [{ value: 0 }, { value: null }],
      });
    });
  });

  test('city=2 excludes NULL cities, matching SQL <> semantics', () => {
    const [city] = conditions(buildParcelWhere(query({ city: '2' }))).filter((c) => 'receiver' in c);
    expect(city).toEqual({
      receiver: { address: { AND: [{ city: { not: null } }, { city: { not: 'Tbilisi' } }] } },
    });
  });

  test('debt is a NOT-equal filter on uninvoiced parcels, and 0 means "has a figure"', () => {
    expect(conditions(buildParcelWhere(query({ debt: '0' })))).toContainEqual({
      debt: { not: null },
      isInvoiced: false,
    });
    expect(conditions(buildParcelWhere(query({ debt: '45.5' })))).toContainEqual({
      debt: { not: 45.5 },
      isInvoiced: false,
    });
  });

  test('paid filter reads is_invoiced, not a per-row invoice-item subquery', () => {
    expect(conditions(buildParcelWhere(query({ isPaid: 'Y' })))).toContainEqual({
      OR: [{ isInvoiced: true }, { debt: null }, { debt: 0 }],
    });
    expect(conditions(buildParcelWhere(query({ isPaid: 'N' })))).toContainEqual({
      isInvoiced: false,
      debt: { gt: 0 },
    });
  });

  test('groupId coerces non-numeric input to 0 rather than erroring', () => {
    expect(conditions(buildParcelWhere(query({ groupId: 'abc' })))).toContainEqual({ groupId: '0' });
    expect(conditions(buildParcelWhere(query({ groupId: '7' })))).toContainEqual({ groupId: '7' });
  });

  test('the extra-search range applies hour and minute to the milestone', () => {
    const [range] = conditions(
      buildParcelWhere(
        query({
          extraStatus: 'delivered',
          fromDate: '2026-07-20',
          fromHour: '9',
          fromMinute: '30',
          toDate: '2026-07-20',
          toHour: '13',
          toMinute: '0',
        }),
      ),
    ).filter((c) => 'trackingDeliveredSigned' in c);
    expect(range.trackingDeliveredSigned).toEqual({
      not: null,
      gte: new Date('2026-07-20T09:30:00.000Z'),
      lt: new Date('2026-07-20T13:00:00.000Z'),
    });
  });
});

describe('buildParcelOrderBy', () => {
  test('maps the legacy sort names and always adds a tiebreaker', () => {
    expect(buildParcelOrderBy('Created', 'desc')).toEqual([{ created: 'desc' }, { id: 'asc' }]);
    expect(buildParcelOrderBy('TrackingNum', 'asc')).toEqual([{ trackingNum: 'asc' }, { id: 'asc' }]);
  });
});

describe('hasMeaningfulFilter', () => {
  test('an untouched query is not a search — this is what scopes the list to the operator', () => {
    expect(hasMeaningfulFilter(query())).toBe(false);
  });

  test('service and paging do not count as filters, matching legacy', () => {
    expect(hasMeaningfulFilter(query({ service: 'Express', perPage: '100', page: '3' }))).toBe(false);
  });

  test('any real filter counts', () => {
    expect(hasMeaningfulFilter(query({ search: 'x' }))).toBe(true);
    expect(hasMeaningfulFilter(query({ status: 'delivered' }))).toBe(true);
    expect(hasMeaningfulFilter(query({ tripDate: '2026-07-20' }))).toBe(true);
  });
});
