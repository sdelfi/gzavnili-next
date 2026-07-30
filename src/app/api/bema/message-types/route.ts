import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';

// Backs the notification checkbox grid on the user form — see prisma/schema.prisma's
// `MessageType` doc comment. Read-only: no bema screen manages this list yet.
export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, ['BemaStandard', 'BemaAdministrator', 'BemaAgent']);
  if (auth.response) return auth.response;

  const messageTypes = await db.messageType.findMany({ orderBy: { sortOrder: 'asc' } });
  return NextResponse.json({ messageTypes });
}
