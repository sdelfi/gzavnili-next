import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';

// The EXPRESS/REGULAR/CARGO "Ship day / Estimate / AVB" panel at the top of the batch "Add
// Parcel" screen (`views/vwParcelsAdd.cfm`) — read-only trip info off the singleton `config`
// row. Cargo has no equivalent `dt_cargo_*`/awb columns in this schema (there weren't any in
// legacy either), so its three fields are always blank, same as legacy renders them. Legacy's
// own label for the AWB code here is "AVB", not "AWB" — kept as-is by the client, not "fixed".
//
// Gated the same as the parcels list itself (any bema role), not `CONFIG_ROLES` from
// `/api/bema/config` — that route is Administrator-only because it edits the popup config;
// this one is read-only trip info every operator adding a parcel needs to see.
const TRIP_INFO_ROLES = ['BemaStandard', 'BemaAdministrator', 'BemaAgent'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...TRIP_INFO_ROLES]);
  if (auth.response) return auth.response;

  const config = await db.config.findUnique({ where: { id: 1 } });

  return NextResponse.json({
    express: {
      shipDate: config?.dtExpressShip?.toISOString() ?? null,
      estimateDate: config?.dtExpressEst?.toISOString() ?? null,
      awb: config?.expAwb ?? null,
    },
    regular: {
      shipDate: config?.dtRegularShip?.toISOString() ?? null,
      estimateDate: config?.dtRegularEst?.toISOString() ?? null,
      awb: config?.regAwb ?? null,
    },
    cargo: {
      shipDate: null,
      estimateDate: null,
      awb: null,
    },
  });
}
