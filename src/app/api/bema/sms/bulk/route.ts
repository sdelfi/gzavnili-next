import { NextRequest, NextResponse } from 'next/server';
import { requireBemaSession } from '@/lib/auth/session';
import { sendBulkSmsSchema } from '@/lib/validation/messageSchema';
import {
  bulkInsertSmsQueue,
  cleanSmsQueue,
  findBulkSmsCandidates,
  getSmsQueuePreview,
  resolveBulkSmsTargets,
} from '@/lib/services/smsBulkQueue';

// bema "Send Bulk SMS" (legacy `bema/messages/sms_add_bulk.cfm`) — see
// docs/decisions/0025-bema-send-bulk-sms.md. Legacy's own gate,
// `WEBSITE_ADMINISTRATOR,CONTENT_ONLY,ADMINISTRATOR`, is narrower than "Send SMS"'s — no
// `AGENT_ADMINISTRATOR` here.
const BULK_SMS_ROLES = ['BemaAdministrator', 'BemaContentOnly'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...BULK_SMS_ROLES]);
  if (auth.response) return auth.response;

  const preview = await getSmsQueuePreview();
  return NextResponse.json(preview);
}

export async function POST(request: NextRequest) {
  const auth = await requireBemaSession(request, [...BULK_SMS_ROLES]);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = sendBulkSmsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { status, country, sendTo, message } = parsed.data;

  // Legacy's own gate here checks `sendTo`/`message` only — the error text still names
  // "country or status" from an earlier, wider condition that was simplified without updating
  // the message. Reproduced verbatim; see docs/findings.md.
  if (sendTo.length === 0 || message === '') {
    return NextResponse.json({ error: 'Please select at least one filter (country or status)' }, { status: 400 });
  }

  const candidates = await findBulkSmsCandidates({ status, country });
  const targets = resolveBulkSmsTargets(candidates, sendTo, message);
  const inserted = await bulkInsertSmsQueue(targets);

  return NextResponse.json({ found: targets.length, inserted });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireBemaSession(request, [...BULK_SMS_ROLES]);
  if (auth.response) return auth.response;

  const cleared = await cleanSmsQueue();
  return NextResponse.json({ cleared });
}
