import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { emailTemplateEditSchema } from '@/lib/validation/systemEmailsSchema';

// Bema "Edit Email" (legacy `bema/config/email_edit.cfm`) — per-template edit. Only
// Sender/Recipients/Subject/Message are writable, matching legacy's `MSSQLEmailDAO.update()`;
// Description/Tags/RecipientOverwrite have no input on that form at all. See
// docs/decisions/0031-system-emails.md.
const EDIT_ROLES = ['BemaAdministrator'] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...EDIT_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const template = await db.emailTemplate.findUnique({ where: { id } });
  if (!template) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  return NextResponse.json({ template });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...EDIT_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = emailTemplateEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await db.emailTemplate.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const updated = await db.emailTemplate.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ template: updated });
}
