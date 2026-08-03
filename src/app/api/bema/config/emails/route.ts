import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { systemEmailConfigSchema } from '@/lib/validation/systemEmailsSchema';

// Bema "System Emails" (legacy `bema/config/emails.cfm`) — "Basic Configuration" section,
// same singleton `config` row as Site Settings/Payment Preferences, gated the same way
// (`WEBSITE_ADMINISTRATOR,ADMINISTRATOR` in legacy). See docs/decisions/0031-system-emails.md.
const CONFIG_ROLES = ['BemaAdministrator'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...CONFIG_ROLES]);
  if (auth.response) return auth.response;

  const config = await db.config.findUnique({ where: { id: 1 } });
  return NextResponse.json({
    config: {
      emailSender: config?.emailSender ?? '',
      emailRecipients: config?.emailRecipients ?? '',
      emailHeader: config?.emailHeader ?? '',
      emailFooter: config?.emailFooter ?? '',
    },
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireBemaSession(request, [...CONFIG_ROLES]);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = systemEmailConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const config = await db.config.upsert({
    where: { id: 1 },
    create: { id: 1, ...parsed.data },
    update: parsed.data,
  });

  return NextResponse.json({
    config: {
      emailSender: config.emailSender ?? '',
      emailRecipients: config.emailRecipients ?? '',
      emailHeader: config.emailHeader ?? '',
      emailFooter: config.emailFooter ?? '',
    },
  });
}
