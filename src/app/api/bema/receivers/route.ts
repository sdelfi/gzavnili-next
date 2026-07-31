import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { PHONE1, PHONE2, PHONE3 } from '@/lib/services/parcelQuery';

// A customer's saved receivers, for the parcel form's "Receiver:" dropdown — legacy
// `bema/ajax/receivers.cfm`, refetched every time the customer changes. The full address of
// each comes back with it (legacy fetched the chosen one separately via
// `bema/ajax/receiver.cfm` on every selection change); one request for a handful of rows
// beats one request per click, and it lets the form fill the address fields instantly.
const RECEIVER_ROLES = ['BemaStandard', 'BemaAdministrator', 'BemaAgent'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...RECEIVER_ROLES]);
  if (auth.response) return auth.response;

  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ receivers: [] });

  const rows = await db.receiver.findMany({
    where: { userId },
    include: { address: true },
    orderBy: [{ address: { lastName: 'asc' } }, { address: { firstName: 'asc' } }],
    take: 200,
  });

  return NextResponse.json({
    receivers: rows.map((row) => ({
      id: row.id,
      isGeCitizen: row.isGeCitizen,
      label:
        [row.address.lastName, row.address.firstName].filter(Boolean).join(', ') ||
        [row.address.lastNameGe, row.address.firstNameGe].filter(Boolean).join(', ') ||
        '(no name)',
      address: {
        firstName: row.address.firstName ?? '',
        lastName: row.address.lastName ?? '',
        firstNameGe: row.address.firstNameGe ?? '',
        lastNameGe: row.address.lastNameGe ?? '',
        organization: row.address.organization ?? '',
        country: row.address.country ?? '',
        street1: row.address.street1 ?? '',
        street2: row.address.street2 ?? '',
        city: row.address.city ?? '',
        state: row.address.state ?? '',
        postalCode: row.address.postalCode ?? '',
        phone1: row.address[PHONE1] ?? '',
        phone2: row.address[PHONE2] ?? '',
        phone3: row.address[PHONE3] ?? '',
      },
    })),
  });
}
