import { NextRequest, NextResponse } from 'next/server';
import { requireBemaSession } from '@/lib/auth/session';
import { resolveOnholdCheck } from '@/lib/services/parcelCheckOnhold';

// bema "Check on hold" (`bema/parcels/parcels-check-onhold.cfm`) — see
// docs/decisions/0028-parcels-check-onhold.md. Gated `WEBSITE_ADMINISTRATOR,ADMINISTRATOR` →
// `BemaAdministrator` only, same as "Add Online Parcel" and "Change Parcel status".
const CHECK_ONHOLD_ROLES = ['BemaAdministrator'] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...CHECK_ONHOLD_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const result = await resolveOnholdCheck(id);
  if (!result) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  return NextResponse.json(result);
}
