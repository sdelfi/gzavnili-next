import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { receiverSchema } from '@/lib/validation/receiverSchema';
import { upsertReceiver } from '@/lib/services/parcelShared';
import { toReceiverDTO } from '@/lib/services/receiverDto';

const RECEIVER_ROLES = ['BemaStandard', 'BemaAdministrator', 'BemaAgent'] as const;
// Legacy `receivers-update.cfm`/`receivers-delete.cfm` — add/edit/delete is
// `WEBSITE_ADMINISTRATOR,ADMINISTRATOR` only, narrower than the browse/picker access.
const WRITE_ROLES = ['BemaAdministrator'] as const;

const RECEIVER_INCLUDE = {
  address: true,
  user: { select: { id: true, username: true, firstName: true, lastName: true } },
} as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...RECEIVER_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const row = await db.receiver.findUnique({ where: { id }, include: RECEIVER_INCLUDE });
  if (!row) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  return NextResponse.json({ receiver: toReceiverDTO(row) });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...WRITE_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const existing = await db.receiver.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = receiverSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { userId, active, ...fields } = parsed.data;

  const customer = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!customer) {
    return NextResponse.json({ error: { fieldErrors: { userId: ['Customer not found.'] } } }, { status: 400 });
  }

  const row = await db.$transaction(async (tx) => {
    // A receiver can be reassigned to a different customer from this screen (legacy's
    // `receivers-update.cfm` lets the admin change the `userid` dropdown on edit); the
    // shared upsert only ever touches the address/isGeCitizen, so the owner change is
    // applied here.
    if (userId !== existing.userId) {
      await tx.receiver.update({ where: { id }, data: { userId } });
    }
    await upsertReceiver(tx, userId, {
      receiverId: id,
      isGeCitizen: fields.isGeCitizen ?? false,
      firstName: fields.firstName,
      lastName: fields.lastName,
      firstNameGe: fields.firstNameGe ?? '',
      lastNameGe: fields.lastNameGe ?? '',
      organization: fields.organization ?? '',
      country: fields.country,
      street1: fields.street1 ?? '',
      street2: fields.street2 ?? '',
      city: fields.city,
      state: fields.state ?? '',
      postalCode: fields.postalCode ?? '',
      phone1: fields.phone1,
      phone2: fields.phone2 ?? '',
      phone3: fields.phone3 ?? '',
    });
    if (active !== undefined) await tx.receiver.update({ where: { id }, data: { active } });
    return tx.receiver.findUniqueOrThrow({ where: { id }, include: RECEIVER_INCLUDE });
  });

  return NextResponse.json({ receiver: toReceiverDTO(row) });
}

// Soft delete — legacy `receivers-delete.cfm` sets `Status = 0` rather than removing the
// row, since a receiver already attached to past parcels can't be hard-deleted without
// orphaning them.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...WRITE_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const existing = await db.receiver.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  await db.receiver.update({ where: { id }, data: { active: false } });
  return new NextResponse(null, { status: 204 });
}
