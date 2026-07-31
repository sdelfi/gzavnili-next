import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';

// The Georgian delivery offices a parcel can be assigned to (parcel form → "Delivery
// Office"). Legacy queried these inline in the view via `deliveryOfficeDao.getOffices()`.
//
// Legacy's dropdown also carries a hard-coded `<option value="999">Need delivery</option>`
// pseudo-office, which `addOfficeToParcel()` then writes as if it were a real office id.
// That can't round-trip here — `parceloffice.office_id` is a real foreign key — and it is
// data, not code: if "Need delivery" is still wanted it belongs in `delivery_offices` as a
// row, which then shows up in this list like any other.
const OFFICE_ROLES = ['BemaStandard', 'BemaAdministrator', 'BemaAgent'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...OFFICE_ROLES]);
  if (auth.response) return auth.response;

  const offices = await db.deliveryOffice.findMany({
    orderBy: [{ city: 'asc' }, { officeName: 'asc' }],
    select: { id: true, officeName: true, officeNameGe: true, city: true, letter: true },
  });

  return NextResponse.json({
    offices: offices.map((office) => ({
      id: office.id,
      label: office.letter ? `${office.officeName} (${office.letter.trim()})` : office.officeName,
    })),
  });
}
