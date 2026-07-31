import { NextRequest, NextResponse } from 'next/server';
import { requireBemaSession } from '@/lib/auth/session';
import { trackingNumExists } from '@/lib/services/parcelUpdate';

// Live "Tracking # already exists" check as the operator types — legacy
// `bema/ajax/trackingnum.cfm`, which the parcel form polls on every change of the field.
// Advisory only: the real check runs again inside the PATCH, where it can't be raced.
export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, ['BemaStandard', 'BemaAdministrator', 'BemaAgent']);
  if (auth.response) return auth.response;

  const trackingNum = (request.nextUrl.searchParams.get('trackingNum') ?? '').trim();
  const excludeId = request.nextUrl.searchParams.get('excludeId') ?? undefined;
  if (!trackingNum) return NextResponse.json({ exists: false });

  return NextResponse.json({ exists: await trackingNumExists(trackingNum, excludeId) });
}
