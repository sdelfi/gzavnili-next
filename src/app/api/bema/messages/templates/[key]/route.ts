import { NextRequest, NextResponse } from 'next/server';
import { requireBemaSession } from '@/lib/auth/session';
import { MAIL_TEMPLATES } from '@/lib/notifications/mailTemplates';

// Mirrors legacy's `/bema/ajax/getTemplateByType.cfc` — the compose form's message-type
// dropdown fetches the raw (un-substituted) template pair for its live preview. See
// docs/decisions/0033-bema-send-message.md. Not every `MessageType` has a template (e.g.
// "Promotion notification"/"Other") — those return blank strings, same as legacy.
const ROLES = ['BemaAdministrator', 'BemaContentOnly'] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const auth = await requireBemaSession(request, [...ROLES]);
  if (auth.response) return auth.response;

  const { key } = await params;
  const template = MAIL_TEMPLATES[decodeURIComponent(key)];

  return NextResponse.json({ en: template?.en ?? '', ge: template?.ge ?? '' });
}
