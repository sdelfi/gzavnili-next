import { NextRequest, NextResponse } from 'next/server';
import { requireBemaSession } from '@/lib/auth/session';
import { composeMessage } from '@/lib/services/messageCompose';
import { composeMessageSchema } from '@/lib/validation/messageSchema';

// bema "Send message" (legacy `bema/messages/message_add.cfm`) — see
// docs/decisions/0033-bema-send-message.md. Legacy's own `require.cfm` groups
// (`WEBSITE_ADMINISTRATOR,CONTENT_ONLY,ADMINISTRATOR`) are wider than the Messages list's
// admin-only gate — no `BemaAgent` here, unlike "Send SMS".
const COMPOSE_ROLES = ['BemaAdministrator', 'BemaContentOnly'] as const;

export async function POST(request: NextRequest) {
  const auth = await requireBemaSession(request, [...COMPOSE_ROLES]);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = composeMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  // Legacy: `trackingnum_2` is appended to `trackingnum` with a comma before either is used as
  // the `{trackingnum}` token — see `message_add.cfm`'s own concatenation.
  const trackingnum = data.trackingnum2
    ? data.trackingnum
      ? `${data.trackingnum}, ${data.trackingnum2}`
      : data.trackingnum2
    : data.trackingnum;

  const id = await composeMessage({
    userId: data.userId,
    parcelId: data.parcelId,
    messageTypeKey: data.messageTypeKey,
    senderId: auth.session.sub,
    subject: data.subject,
    subjectGe: data.subjectGe,
    message: data.message,
    gemessage: data.gemessage,
    tokens: {
      trackingnum,
      firstname: data.firstname,
      today: data.today,
      rname: data.rname,
      rcity: data.rcity,
      receiverid: data.receiverid,
      senddate: data.senddate,
      deliverydate: data.deliverydate,
      servicetransit: data.servicetransit,
      missinginfo: data.missinginfo,
      service: data.service,
    },
  });

  return NextResponse.json({ id }, { status: 201 });
}
