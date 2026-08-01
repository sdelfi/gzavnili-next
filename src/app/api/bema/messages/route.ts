import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { listMessagesQuerySchema } from '@/lib/validation/messageSchema';

// bema "Messages" (legacy `bema/messages/messages.cfm`) — see
// docs/decisions/0021-bema-messages.md.
const MESSAGE_ROLES = ['BemaAdministrator'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...MESSAGE_ROLES]);
  if (auth.response) return auth.response;

  const parsed = listMessagesQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { page, perPage, search, chain, userId } = parsed.data;

  const where = {
    isSms: false,
    ...(userId ? { userId } : {}),
    ...(chain !== undefined ? { chain } : {}),
    ...(search
      ? {
          OR: [
            { subject: { contains: search, mode: 'insensitive' as const } },
            { body: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    db.message.count({ where }),
    db.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        chain: true,
        replyToId: true,
        subject: true,
        active: true,
        read: true,
        createdAt: true,
        user: { select: { username: true } },
        sender: { select: { username: true } },
        parcel: { select: { trackingNum: true } },
        messageType: { select: { label: true } },
      },
    }),
  ]);

  return NextResponse.json({
    items: items.map((m) => ({
      id: m.id,
      chain: m.chain,
      replyToId: m.replyToId,
      username: m.user?.username ?? null,
      senderUsername: m.sender?.username ?? null,
      trackingNum: m.parcel?.trackingNum ?? null,
      subject: m.subject,
      // legacy's own "Message" column shows the message *type* label, not the body — see
      // docs/findings.md's "Messages" section.
      messageTypeLabel: m.messageType?.label ?? null,
      createdAt: m.createdAt.toISOString(),
      active: m.active,
      read: m.read,
    })),
    total,
    page,
    perPage,
  });
}
