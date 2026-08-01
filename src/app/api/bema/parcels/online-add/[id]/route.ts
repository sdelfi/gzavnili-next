import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { updateOnlineParcel } from '@/lib/services/parcelOnlineAdd';
import { updateOnlineParcelSchema } from '@/lib/validation/parcelOnlineAddSchema';
import { flattenIssues } from '@/lib/validation/zodErrors';

const ONLINE_ADD_ROLES = ['BemaAdministrator'] as const;

// The "Update parcel" branch — legacy reaches this only when the tracking-number lookup found
// an existing, upgradable parcel (`form.PARCELID` gets set client-side); no server-side
// status re-check happens here, matching legacy exactly (see docs/decisions/0022).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...ONLINE_ADD_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const existing = await db.parcel.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = updateOnlineParcelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: flattenIssues(parsed.error) }, { status: 400 });
  }

  const updated = await updateOnlineParcel(id, parsed.data);
  return NextResponse.json({ parcel: updated });
}
