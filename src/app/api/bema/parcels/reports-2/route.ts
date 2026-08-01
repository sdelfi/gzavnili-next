import { NextRequest, NextResponse } from 'next/server';
import { requireBemaSession } from '@/lib/auth/session';
import { parcelsReportQuerySchema } from '@/lib/validation/parcelReportsSchema';
import { getParcelsSalesReport } from '@/lib/services/parcelSalesReport';

// "Parcels Reports 2" — legacy `parcels-reports-2-v2.cfm`'s
// `groups="WEBSITE_ADMINISTRATOR,ADMINISTRATOR"`, same mapping as "Parcels Reports" and the
// Customers/BEMA Users list screen (see src/app/api/bema/users/route.ts's `LIST_ROLES`).
const ALLOWED_ROLES = ['BemaStandard', 'BemaAdministrator'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...ALLOWED_ROLES]);
  if (auth.response) return auth.response;

  const parsed = parcelsReportQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const start = new Date(`${parsed.data.dateStart}T00:00:00.000Z`);
  const end = new Date(`${parsed.data.dateEnd}T23:59:59.000Z`);

  const report = await getParcelsSalesReport({ start, end });
  return NextResponse.json(report);
}
