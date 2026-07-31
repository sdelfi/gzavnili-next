import { NextRequest, NextResponse } from 'next/server';
import { getBemaSession } from '@/lib/auth/session';
import { publicUser } from '@/lib/auth/publicUser';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const session = await getBemaSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  // The billing country comes along because the bema parcels screen offers a different set
  // of payment methods to a Georgia-based admin than to a US-based one — legacy resolved the
  // same thing per page render via `userDao.retrieveBillingDefault()` and cached it on the
  // session as `session.buser.country`.
  const user = await db.user.findUnique({
    where: { id: session.sub },
    include: { billingAddress: { select: { country: true } } },
  });
  if (!user || user.accountType !== 'BemaUser' || !user.active || !user.adminRole) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  return NextResponse.json({ user: publicUser(user) });
}
