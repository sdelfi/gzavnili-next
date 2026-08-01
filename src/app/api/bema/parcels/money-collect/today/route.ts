import { NextRequest, NextResponse } from 'next/server';
import { requireBemaSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { getTodayCollectedTotal } from '@/lib/services/moneyCollect';

const ALLOWED_ROLES = ['BemaStandard', 'BemaAdministrator', 'BemaAgent'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...ALLOWED_ROLES]);
  if (auth.response) return auth.response;

  const user = await db.user.findUnique({
    where: { id: auth.session.sub },
    select: { username: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const total = await getTodayCollectedTotal(user.username);
  return NextResponse.json({ total });
}
