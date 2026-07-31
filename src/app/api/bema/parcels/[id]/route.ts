import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { runParcelOperation } from '@/lib/services/parcelOperations';
import { saveParcel, trackingNumExists } from '@/lib/services/parcelUpdate';
import { PARCEL_DETAIL_INCLUDE, toParcelDetail } from '@/lib/services/parcelDetail';
import { updateParcelSchema } from '@/lib/validation/parcelSchema';
import { flattenIssues } from '@/lib/validation/zodErrors';

// Legacy `bema/parcels/parcels-update.cfm` and `parcels-delete.cfm` both allow the wider
// `WEBSITE_ADMINISTRATOR,ADMINISTRATOR,AGENT_ADMINISTRATOR` set than `parcels-operation.cfm`
// does for the bulk toolbar. Kept as-is rather than tightened.
const EDIT_ROLES = ['BemaStandard', 'BemaAdministrator', 'BemaAgent'] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...EDIT_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const parcel = await db.parcel.findUnique({ where: { id }, include: PARCEL_DETAIL_INCLUDE });
  if (!parcel) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  return NextResponse.json({ parcel: toParcelDetail(parcel) });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...EDIT_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const existing = await db.parcel.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = updateParcelSchema.safeParse(body);
  if (!parsed.success) {
    // Dotted paths, not `flatten()`'s single level — the form's receiver/customer sections
    // key their per-field messages by `receiver.city`, `customer.phone1` and so on.
    return NextResponse.json({ error: flattenIssues(parsed.error) }, { status: 400 });
  }

  // Uniqueness is checked here rather than in the schema because it needs the database and
  // the parcel's own id — the same reason legacy's `ParcelUpdate.cfc` calls
  // `parcelDao.trackingNumExists(trackingNum, parcelId)` from inside its validator.
  if (await trackingNumExists(parsed.data.trackingNum, id)) {
    return NextResponse.json(
      { error: { formErrors: [], fieldErrors: { trackingNum: ['Tracking # is already in use.'] } } },
      { status: 409 },
    );
  }

  await saveParcel(id, parsed.data);

  const parcel = await db.parcel.findUnique({ where: { id }, include: PARCEL_DETAIL_INCLUDE });
  return NextResponse.json({ parcel: parcel && toParcelDetail(parcel) });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...EDIT_ROLES]);
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
