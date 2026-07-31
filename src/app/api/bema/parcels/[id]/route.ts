import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { runParcelOperation } from '@/lib/services/parcelOperations';

// Legacy `bema/parcels/parcels-delete.cfm` allows the wider
// `WEBSITE_ADMINISTRATOR,ADMINISTRATOR,AGENT_ADMINISTRATOR` set for a single-row delete than
// `parcels-operation.cfm` does for the bulk one. Kept as-is rather than tightened.
const DELETE_ROLES = ['BemaStandard', 'BemaAdministrator', 'BemaAgent'] as const;

// "Removed from On Hold → Confirm" on the list: clears both hold flags, which lets the
// trigger recompute the parcel's real status from its milestones. Legacy ran this UPDATE
// inline at the top of the list page itself, off a `?rid=…` link — a GET that mutated data,
// and one any crawler or prefetch could fire. Same effect, as a PATCH.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...DELETE_ROLES]);
  if (auth.response) return auth.response;

  const body = (await request.json().catch(() => null)) as { clearHold?: unknown } | null;
  if (body?.clearHold !== true) {
    return NextResponse.json({ error: 'Unsupported update.' }, { status: 400 });
  }

  const { id } = await params;
  const parcel = await db.parcel.findUnique({ where: { id }, select: { id: true } });
  if (!parcel) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  await db.parcel.update({ where: { id }, data: { bOnHold: false, bNotOnHold: false } });
  return new NextResponse(null, { status: 204 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...DELETE_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const parcel = await db.parcel.findUnique({ where: { id }, select: { id: true } });
  if (!parcel) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  // Same code path as the bulk "Delete" operation, so the two can't clean up different
  // things — legacy had `parcels-delete.cfm` call `ParcelDAO.delete()` while the bulk
  // operation issued its own `delete from parcels`.
  await runParcelOperation({
    operation: 'delete',
    parcelIds: [id],
    payMethod1: '',
    pCode: '',
    awb: '',
    buser: '',
  });

  return new NextResponse(null, { status: 204 });
}
