import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';

// The EXPRESS/REGULAR/CARGO "Ship day / Estimate / AVB" panel at the top of the batch "Add
// Parcel" screen (`views/vwParcelsAdd.cfm`) — read-only trip info off the singleton `config`
// row. Cargo's ship/estimate dates are real config columns (`config.dtCargoShip`/
// `dtCargoEst`, added once `bema/config/settings.cfm`'s source was available — an earlier pass
// wrongly assumed legacy had no cargo dates at all). Cargo's AWB field genuinely stays blank:
// legacy's `Config.cfc` has no `CargoAWB` getter — only Regular/Express have their own AWB
// column. Legacy's own label for the AWB code here is "AVB", not "AWB" — kept as-is by the
// client, not "fixed".
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
      shipDate: config?.dtCargoShip?.toISOString() ?? null,
      estimateDate: config?.dtCargoEst?.toISOString() ?? null,
      awb: null,
    },
    // "Add Online Parcel"'s live price calculator (docs/decisions/0022-parcels-online-add.md)
    // — the only other reader of `Config` this permissively-gated read needs to cover.
    declaredPrice: config?.declaredPrice ? Number(config.declaredPrice) || 0 : 0,
    nonDeclaredPrice: config?.nonDeclaredPrice ? Number(config.nonDeclaredPrice) || 0 : 0,
  });
}
