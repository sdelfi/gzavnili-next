import { NextRequest, NextResponse } from 'next/server';
import { requireBemaSession } from '@/lib/auth/session';
import { parcelsReportQuerySchema } from '@/lib/validation/parcelReportsSchema';
import { getParcelsReport } from '@/lib/services/parcelReports';

// "Parcels Reports" — legacy `parcels-reports.cfm`'s
// `groups="WEBSITE_ADMINISTRATOR,ADMINISTRATOR"`, same mapping as the Customers/BEMA Users
// list screen (see src/app/api/bema/users/route.ts's `LIST_ROLES`).
const ALLOWED_ROLES = ['BemaStandard', 'BemaAdministrator'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...ALLOWED_ROLES]);
  if (auth.response) return auth.response;

  const parsed = parcelsReportQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const start = new Date(`${parsed.data.dateStart}T00:00:00.000Z`);
  // legacy: `dateend & ' 23:55:55'` — not 23:59:59, ported verbatim (see docs/findings.md).
  const end = new Date(`${parsed.data.dateEnd}T23:55:55.000Z`);

  const report = await getParcelsReport({ start, end });
  return NextResponse.json(report);
}
