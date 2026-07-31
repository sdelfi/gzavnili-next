import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { receiverSchema, listReceiversQuerySchema } from '@/lib/validation/receiverSchema';
import { upsertReceiver } from '@/lib/services/parcelShared';
import { toReceiverDTO } from '@/lib/services/receiverDto';

// A customer's saved receivers, for the parcel form's "Receiver:" dropdown — legacy
// `bema/ajax/receivers.cfm`, refetched every time the customer changes. The full address of
// each comes back with it (legacy fetched the chosen one separately via
// `bema/ajax/receiver.cfm` on every selection change); one request for a handful of rows
// beats one request per click, and it lets the form fill the address fields instantly.
//
// This same GET also backs the standalone Receivers browse screen (legacy `receivers.cfm`)
// — when the request carries a `page` param it switches to paginated/searchable "browse"
// mode (`{ items, total }`, matching every other bema list screen's shape); without `page`
// it keeps the exact `{ receivers }` shape above, since that's a live contract the parcel
// form's picker (`listReceivers()` in `src/lib/api/bema/parcels.ts`) already depends on.
const RECEIVER_ROLES = ['BemaStandard', 'BemaAdministrator', 'BemaAgent'] as const;
// Legacy `receivers-update.cfm`/`receivers-delete.cfm` restrict add/edit/delete to
// `WEBSITE_ADMINISTRATOR,ADMINISTRATOR` — narrower than the browse/picker access above.
const WRITE_ROLES = ['BemaAdministrator'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...RECEIVER_ROLES]);
  if (auth.response) return auth.response;

  const params = request.nextUrl.searchParams;

  if (params.has('page')) {
    const parsed = listReceiversQuerySchema.safeParse(Object.fromEntries(params));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { page, perPage, search, userId, active, sort, dir } = parsed.data;

    // Space-delimited AND-of-OR across the receiver's own name/organization and the
    // sender/customer's name — matches the legacy `getReceivers()` keyword search, which
    // checks both the receiver's address and the billing customer's address.
    const keywordFilters: Prisma.ReceiverWhereInput[] = (search ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => ({
        OR: [
          { address: { firstName: { contains: term, mode: 'insensitive' as const } } },
          { address: { lastName: { contains: term, mode: 'insensitive' as const } } },
          { address: { organization: { contains: term, mode: 'insensitive' as const } } },
          { user: { firstName: { contains: term, mode: 'insensitive' as const } } },
          { user: { lastName: { contains: term, mode: 'insensitive' as const } } },
        ],
      }));

    const where: Prisma.ReceiverWhereInput = {
      ...(userId ? { userId } : {}),
      ...(active ? { active: active === 'true' } : {}),
      AND: keywordFilters,
    };

    const [total, rows] = await Promise.all([
      db.receiver.count({ where }),
      db.receiver.findMany({
        where,
        include: { address: true, user: { select: { id: true, username: true, firstName: true, lastName: true } } },
        orderBy: [{ address: { [sort]: dir } }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return NextResponse.json({ items: rows.map(toReceiverDTO), total, page, perPage });
  }

  const userId = params.get('userId');
  if (!userId) return NextResponse.json({ receivers: [] });

  const rows = await db.receiver.findMany({
    where: { userId },
    include: { address: true },
    orderBy: [{ address: { lastName: 'asc' } }, { address: { firstName: 'asc' } }],
    take: 200,
  });

  return NextResponse.json({ receivers: rows.map(toReceiverDTO) });
}

export async function POST(request: NextRequest) {
  const auth = await requireBemaSession(request, [...WRITE_ROLES]);
  if (auth.response) return auth.response;

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
    const id = await upsertReceiver(tx, userId, {
      receiverId: null,
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
    if (active === false) await tx.receiver.update({ where: { id }, data: { active: false } });
    return tx.receiver.findUniqueOrThrow({
      where: { id },
      include: { address: true, user: { select: { id: true, username: true, firstName: true, lastName: true } } },
    });
  });

  return NextResponse.json({ receiver: toReceiverDTO(row) }, { status: 201 });
}
