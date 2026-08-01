import { NextRequest, NextResponse } from 'next/server';
import { requireBemaSession } from '@/lib/auth/session';
import { lookupParcelByTrackingNumber } from '@/lib/services/parcelOnlineLookup';

// The tracking-number lookup — legacy `bema/ajax/getParcel.cfm`, shared by "Add Online
// Parcel" (docs/decisions/0022), "Change Parcel status" (docs/decisions/0023), and "Send SMS"
// (docs/decisions/0024), the same way the one legacy ajax endpoint serves all three with
// different query params. Gated the union of what those screens' own page-level gates allow —
// "Send SMS" has the widest (`WEBSITE_ADMINISTRATOR,CONTENT_ONLY,ADMINISTRATOR,
// AGENT_ADMINISTRATOR` → `BemaAdministrator`/`BemaContentOnly`/`BemaAgent`), a superset of the
// other two screens' `WEBSITE_ADMINISTRATOR,ADMINISTRATOR` → `BemaAdministrator`.
const ONLINE_LOOKUP_ROLES = ['BemaAdministrator', 'BemaAgent', 'BemaContentOnly'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...ONLINE_LOOKUP_ROLES]);
  if (auth.response) return auth.response;

  const trackingNum = request.nextUrl.searchParams.get('trackingNum') ?? '';
  const cutLengthParam = request.nextUrl.searchParams.get('cutLength');
  const withTrackingNum2Param = request.nextUrl.searchParams.get('withTrackingNum2');
  const cutParam = request.nextUrl.searchParams.get('cut');
  const parcel = await lookupParcelByTrackingNumber(trackingNum, {
    cutLength: cutLengthParam ? Number(cutLengthParam) : undefined,
    withTrackingNum2: withTrackingNum2Param === null ? undefined : withTrackingNum2Param === '1',
    cut: cutParam === 'exact' ? 'exact' : undefined,
  });
  return NextResponse.json({ parcel });
}
