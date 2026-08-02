import { NextRequest, NextResponse } from 'next/server';
import { requireBemaSession } from '@/lib/auth/session';
import { listParcelHistory } from '@/lib/services/parcelHistory';

// "View Parcel"'s History table (`bema/parcels/parcels-view.cfm`) — see
// docs/decisions/0029-parcels-barcode-print.md. Same role gate as the View page itself.
const HISTORY_ROLES = ['BemaAdministrator', 'BemaAgent'] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...HISTORY_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const history = await listParcelHistory(id);
  return NextResponse.json({ history });
}
