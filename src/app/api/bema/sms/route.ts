import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { listSmsQuerySchema, sendSmsSchema } from '@/lib/validation/messageSchema';
import { formatPhone, sendSms } from '@/lib/services/smsGateway';

// bema "SMS list" (legacy `bema/messages/sms.cfm`) — read-only, same shared `messages` table
// as "Messages" (`isSms` rows only). Legacy's own view has no edit/delete action (the one
// `<a>` it had is HTML-commented-out) — see docs/decisions/0021-bema-messages.md.
const SMS_ROLES = ['BemaAdministrator'] as const;

// bema "Send SMS" (legacy `bema/messages/sms_add.cfm`) — see
// docs/decisions/0024-bema-send-sms.md. Wider than the list's own gate: legacy's own
// `require.cfm` call adds `CONTENT_ONLY`/`AGENT_ADMINISTRATOR` on top of
// `WEBSITE_ADMINISTRATOR,ADMINISTRATOR`.
const SEND_SMS_ROLES = ['BemaAdministrator', 'BemaAgent', 'BemaContentOnly'] as const;

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

export async function POST(request: NextRequest) {
  const auth = await requireBemaSession(request, [...SEND_SMS_ROLES]);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = sendSmsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { phone1, message } = parsed.data;

  // Legacy always calls in with type "GE" — see smsGateway.ts's doc comment.
  const formatted = formatPhone(phone1, 'GE');
  if (formatted === 0) {
    return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
  }

  const smsTo = await sendSms(formatted, message, 'GE');

  // `userId`/`parcelId`/`senderId` are left null — not a stopgap, this is legacy's own actual
  // behavior. See docs/findings.md's "Send SMS" section: the tracking-number lookup's
  // `#parcelid` field is never actually populated (a JSON key-casing bug in `sms-add.js`) and
  // `#userid` is never wired to anything at all, so every SMS sent through this screen already
  // carries a blank `UserID`/`ParcelID` in legacy; `sender` there gets the destination phone
  // number (not the sending admin), which doesn't fit this schema's `senderId` UUID FK at all.
  const created = await db.message.create({
    data: {
      isSms: true,
      smsBody: message,
      smsTo,
    },
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
