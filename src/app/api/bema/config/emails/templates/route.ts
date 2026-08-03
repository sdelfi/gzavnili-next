import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';

// Bema "System Emails" → "Specific Emails" list (legacy `bema/config/emails.cfm`'s
// `emailTemplates` table). The row set is fixed (see docs/decisions/0031-system-emails.md) —
// this is a plain, unpaginated list, same as the legacy `<table class="browse">`.
const CONFIG_ROLES = ['BemaAdministrator'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...CONFIG_ROLES]);
  if (auth.response) return auth.response;

  const templates = await db.emailTemplate.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, description: true },
  });

  return NextResponse.json({ templates });
}
