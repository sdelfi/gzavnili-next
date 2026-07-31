import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { listParcelsQuerySchema } from '@/lib/validation/parcelSchema';
import {
  PARCEL_LIST_INCLUDE,
  buildParcelOrderBy,
  buildParcelWhere,
  hasMeaningfulFilter,
  loadAdminNames,
  toParcelListItem,
} from '@/lib/services/parcelQuery';
import type { ParcelListResponse } from '@/lib/parcels/types';

// Legacy `bema/parcels/parcels.cfm` requires one of SALES_MANAGER / WEBSITE_ADMINISTRATOR /
// ADMINISTRATOR / AGENT_ADMINISTRATOR — i.e. every bema role there is. This schema's three
// roles are the equivalent set (docs/decisions/0011-bema-admin.md).
const PARCEL_ROLES = ['BemaStandard', 'BemaAdministrator', 'BemaAgent'] as const;

// The list shows a total, and an exact `count(*)` over a filtered slice of a million-row
// table costs ~200-500ms — several times what the page of 25 rows costs, and paid on every
// keystroke-free page load. Counting is therefore capped: the total is exact up to this many
// rows and reported as "10,000+" beyond it (`totalIsExact: false`), which takes ~3ms. Nobody
// pages to row 650,000; legacy computed the exact count every time and it is a large part of
// why the screen was slow. See docs/decisions/0016-parcels-performance.md.
const COUNT_CAP = 10_000;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...PARCEL_ROLES]);
  if (auth.response) return auth.response;

  const parsed = listParcelsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const query = parsed.data;

  // Two implicit "Received By" scopes, both straight from legacy `parcels.cfm`:
  // an agent may only ever see the parcels they received themselves (enforced here on the
  // server, where legacy only enforced it by overwriting a URL param in the view), and an
  // unfiltered page load defaults to the same scope for everyone else so the first screen is
  // the operator's own work rather than the entire table.
  let forcedReceivedBy: string | null = null;
  if (auth.session.role === 'BemaAgent') {
    forcedReceivedBy = auth.session.sub;
    query.receivedBy = auth.session.sub;
  } else if (!query.receivedBy && query.allReceivers !== '1' && !hasMeaningfulFilter(query)) {
    forcedReceivedBy = auth.session.sub;
    query.receivedBy = auth.session.sub;
  }

  const where = buildParcelWhere(query);

  const [cappedTotal, rows, config] = await Promise.all([
    db.parcel.count({ where, take: COUNT_CAP + 1 }),
    db.parcel.findMany({
      where,
      orderBy: buildParcelOrderBy(query.sort, query.dir),
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
      include: PARCEL_LIST_INCLUDE,
    }),
    db.config.findUnique({ where: { id: 1 }, select: { crate: true } }),
  ]);

  const adminNames = await loadAdminNames(rows);
  const totalIsExact = cappedTotal <= COUNT_CAP;

  const body: ParcelListResponse = {
    items: rows.map((row) => toParcelListItem(row, adminNames)),
    total: totalIsExact ? cappedTotal : COUNT_CAP,
    totalIsExact,
    page: query.page,
    perPage: query.perPage,
    lariRate: config?.crate ? Number(config.crate) || null : null,
    forcedReceivedBy,
  };

  return NextResponse.json(body);
}
