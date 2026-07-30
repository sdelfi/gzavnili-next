import { NextRequest, NextResponse } from 'next/server';
import { getBemaSession } from '@/lib/auth/session';
import { publicUser } from '@/lib/auth/publicUser';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const session = await getBemaSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { id: session.sub } });
  if (!user || user.accountType !== 'BemaUser' || !user.active || !user.adminRole) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  return NextResponse.json({ user: publicUser(user) });
}
