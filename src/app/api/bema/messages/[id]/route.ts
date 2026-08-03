import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';

// legacy `messages.cfm?id=...&action=active|inactive` (status toggle) and
// `messages.cfm?id=...&action=delete`.
const MESSAGE_ROLES = ['BemaAdministrator'] as const;

// "View message" (legacy `message_view.cfm`) — see docs/decisions/0033-bema-send-message.md.
// Same wider gate as compose: `WEBSITE_ADMINISTRATOR,CONTENT_ONLY,ADMINISTRATOR`.
const VIEW_ROLES = ['BemaAdministrator', 'BemaContentOnly'] as const;

const patchSchema = z.object({ active: z.boolean() });

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...VIEW_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const messageId = Number(id);
  if (!Number.isInteger(messageId)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const message = await db.message.findUnique({
    where: { id: messageId },
    include: {
      user: { select: { username: true } },
      sender: { select: { username: true } },
      parcel: { select: { trackingNum: true } },
    },
  });
  if (!message) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  // Legacy: when this message is itself a reply (`replytoID > 0`), the view also shows the
  // body of the message it replied to, above this one's own body.
  const replyMessage =
    message.replyToId != null
      ? await db.message.findUnique({
          where: { id: message.replyToId },
          select: { bodyFormatted: true, bodyFormattedGe: true },
        })
      : null;

  return NextResponse.json({
    message: {
      id: message.id,
      chain: message.chain,
      replyToId: message.replyToId,
      senderUsername: message.sender?.username ?? null,
      username: message.user?.username ?? null,
      trackingNum: message.parcel?.trackingNum ?? null,
      subject: message.subject,
      subjectGe: message.subjectGe,
      bodyFormatted: message.bodyFormatted,
      bodyFormattedGe: message.bodyFormattedGe,
      createdAt: message.createdAt.toISOString(),
    },
    replyMessage: replyMessage
      ? { bodyFormatted: replyMessage.bodyFormatted, bodyFormattedGe: replyMessage.bodyFormattedGe }
      : null,
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...MESSAGE_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const messageId = Number(id);
  if (!Number.isInteger(messageId)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await db.message.findUnique({ where: { id: messageId } });
  if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const updated = await db.message.update({ where: { id: messageId }, data: { active: parsed.data.active } });

  return NextResponse.json({ message: { id: updated.id, active: updated.active } });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...MESSAGE_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const messageId = Number(id);
  if (!Number.isInteger(messageId)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const existing = await db.message.findUnique({ where: { id: messageId } });
  if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  await db.message.delete({ where: { id: messageId } });

  return new NextResponse(null, { status: 204 });
}
