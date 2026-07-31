import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';

// "Removed from On Hold → Confirm" on the parcels list: clears both hold flags, which lets
// the status trigger recompute the parcel's real status from its milestones.
//
// Legacy ran this UPDATE inline at the top of the list page itself, off a `?rid=…` link — a
// GET that mutated data, and one any crawler or link prefetch could fire. It lives here as
// its own action endpoint rather than as a field on the parcel-edit PATCH, because it is one
// (`parcels.cfm?rid=…`), and because the edit form has no control for it.
const CLEAR_HOLD_ROLES = ['BemaStandard', 'BemaAdministrator', 'BemaAgent'] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...CLEAR_HOLD_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const parcel = await db.parcel.findUnique({ where: { id }, select: { id: true } });
  if (!parcel) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  await db.parcel.update({ where: { id }, data: { bOnHold: false, bNotOnHold: false } });
  return new NextResponse(null, { status: 204 });
}
