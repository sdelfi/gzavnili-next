import { NextRequest, NextResponse } from 'next/server';
import { requireBemaSession } from '@/lib/auth/session';
import { lookupParcelByTrackingNumber } from '@/lib/services/parcelOnlineLookup';

// The tracking-number lookup — legacy `bema/ajax/getParcel.cfm`, shared by "Add Online
// Parcel" (docs/decisions/0022) and "Change Parcel status" (docs/decisions/0023), the same
// way the one legacy ajax endpoint serves both with different query params. Gated the same
// narrower allow-list both screens use (`WEBSITE_ADMINISTRATOR,ADMINISTRATOR` in legacy →
// `BemaAdministrator` here), not the wider parcels-edit set.
const ONLINE_ADD_ROLES = ['BemaAdministrator'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...ONLINE_ADD_ROLES]);
  if (auth.response) return auth.response;

  const trackingNum = request.nextUrl.searchParams.get('trackingNum') ?? '';
  const cutLengthParam = request.nextUrl.searchParams.get('cutLength');
  const withTrackingNum2Param = request.nextUrl.searchParams.get('withTrackingNum2');
  const parcel = await lookupParcelByTrackingNumber(trackingNum, {
    cutLength: cutLengthParam ? Number(cutLengthParam) : undefined,
    withTrackingNum2: withTrackingNum2Param === null ? undefined : withTrackingNum2Param === '1',
  });
  return NextResponse.json({ parcel });
}
