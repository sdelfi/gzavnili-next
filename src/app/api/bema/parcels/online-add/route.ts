import { NextRequest, NextResponse } from 'next/server';
import { requireBemaSession } from '@/lib/auth/session';
import { resolveActingUser } from '@/lib/services/parcelHistory';
import { createOnlineParcel, MissingCustomerError, TrackingNumberConflictError } from '@/lib/services/parcelOnlineAdd';
import { createOnlineParcelSchema } from '@/lib/validation/parcelOnlineAddSchema';
import { flattenIssues } from '@/lib/validation/zodErrors';

const ONLINE_ADD_ROLES = ['BemaAdministrator'] as const;

export async function POST(request: NextRequest) {
  const auth = await requireBemaSession(request, [...ONLINE_ADD_ROLES]);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createOnlineParcelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: flattenIssues(parsed.error) }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const acting = await resolveActingUser(auth.session.sub);
    const created = await createOnlineParcel(
      {
        ...input,
        userId: input.userId || undefined,
        receiver:
          input.tab === 'known' && input.receiver
            ? { ...input.receiver, receiverId: input.receiver.receiverId || null }
            : undefined,
      },
      acting,
    );
    return NextResponse.json({ parcel: created }, { status: 201 });
  } catch (err) {
    if (err instanceof TrackingNumberConflictError) {
      return NextResponse.json(
        { error: { formErrors: [], fieldErrors: { trackingNum: ['Tracking # already exists.'] } } },
        { status: 409 },
      );
    }
    if (err instanceof MissingCustomerError) {
      return NextResponse.json(
        { error: { formErrors: [], fieldErrors: { userId: ['You need to fill customer field'] } } },
        { status: 400 },
      );
    }
    throw err;
  }
}
