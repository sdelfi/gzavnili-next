import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { resolveActingUser } from '@/lib/services/parcelHistory';
import { applyParcelStatusChange } from '@/lib/services/parcelChangeStatus';
import { changeParcelStatusSchema } from '@/lib/validation/parcelChangeStatusSchema';
import { flattenIssues } from '@/lib/validation/zodErrors';

// bema "Change Parcel status" (`bema/parcels/parcels-change-status.cfm`) — see
// docs/decisions/0023-parcels-change-status.md.
const CHANGE_STATUS_ROLES = ['BemaAdministrator'] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...CHANGE_STATUS_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const existing = await db.parcel.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = changeParcelStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: flattenIssues(parsed.error) }, { status: 400 });
  }

  const acting = await resolveActingUser(auth.session.sub);
  await applyParcelStatusChange({ parcelId: id, ...parsed.data }, acting);

  return NextResponse.json({ ok: true });
}
