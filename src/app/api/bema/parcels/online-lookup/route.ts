import { NextRequest, NextResponse } from 'next/server';
import { requireBemaSession } from '@/lib/auth/session';
import { lookupParcelByTrackingNumber } from '@/lib/services/parcelOnlineLookup';

// "Add Online Parcel"'s tracking-number lookup — legacy `bema/ajax/getParcel.cfm`. Gated the
// same narrower allow-list as the rest of this screen (`WEBSITE_ADMINISTRATOR,ADMINISTRATOR`
// in legacy → `BemaAdministrator` here), not the wider parcels-edit set.
const ONLINE_ADD_ROLES = ['BemaAdministrator'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...ONLINE_ADD_ROLES]);
  if (auth.response) return auth.response;

  const trackingNum = request.nextUrl.searchParams.get('trackingNum') ?? '';
  const parcel = await lookupParcelByTrackingNumber(trackingNum);
  return NextResponse.json({ parcel });
}
