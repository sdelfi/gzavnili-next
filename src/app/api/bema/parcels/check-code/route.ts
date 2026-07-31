import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';

// Legacy `bema/ajax/checkCode.cfm`. The "Change code" bulk operation calls this first: a
// non-zero count means the code is already on other parcels, and the operator gets a
// confirm() before reusing it. Codes are deliberately not unique — a whole sender/trip group
// shares one — so this is a warning, never a rejection.
export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, ['BemaStandard', 'BemaAdministrator', 'BemaAgent']);
  if (auth.response) return auth.response;

  const pcode = (request.nextUrl.searchParams.get('pcode') ?? '').trim();
  if (!pcode) return NextResponse.json({ count: 0 });

  const count = await db.parcel.count({ where: { pcode } });
  return NextResponse.json({ count });
}
