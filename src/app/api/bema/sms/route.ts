import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { listSmsQuerySchema } from '@/lib/validation/messageSchema';

// bema "SMS list" (legacy `bema/messages/sms.cfm`) — read-only, same shared `messages` table
// as "Messages" (`isSms` rows only). Legacy's own view has no edit/delete action (the one
// `<a>` it had is HTML-commented-out) — see docs/decisions/0021-bema-messages.md.
const SMS_ROLES = ['BemaAdministrator'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...SMS_ROLES]);
  if (auth.response) return auth.response;

  const parsed = listSmsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { page, perPage, search, userId } = parsed.data;

  const where = {
    isSms: true,
    ...(userId ? { userId } : {}),
    ...(search
      ? {
          OR: [
            { smsBody: { contains: search, mode: 'insensitive' as const } },
            { smsTo: { contains: search, mode: 'insensitive' as const } },
            { parcel: { trackingNum: { contains: search, mode: 'insensitive' as const } } },
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
        smsTo: true,
        smsBody: true,
        createdAt: true,
        parcel: { select: { trackingNum: true } },
      },
    }),
  ]);

  return NextResponse.json({
    items: items.map((m) => ({
      id: m.id,
      smsTo: m.smsTo,
      smsBody: m.smsBody,
      trackingNum: m.parcel?.trackingNum ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
    total,
    page,
    perPage,
  });
}
