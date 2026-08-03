import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { replyToMessage } from '@/lib/services/messageCompose';
import { replyMessageSchema } from '@/lib/validation/messageSchema';

// "Reply to message" (legacy `message_view.cfm`'s own POST handler) — see
// docs/decisions/0033-bema-send-message.md.
const REPLY_ROLES = ['BemaAdministrator', 'BemaContentOnly'] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...REPLY_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const messageId = Number(id);
  if (!Number.isInteger(messageId)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const existing = await db.message.findUnique({ where: { id: messageId } });
  if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = replyMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const newId = await replyToMessage(messageId, parsed.data);
  return NextResponse.json({ id: newId }, { status: 201 });
}
