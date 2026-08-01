import { NextRequest, NextResponse } from 'next/server';
import { requireBemaSession } from '@/lib/auth/session';
import { moneyCollectQuerySchema } from '@/lib/validation/moneyCollectSchema';
import { getMoneyCollectReport } from '@/lib/services/moneyCollect';

// "Money collect" — legacy `bema/parcels/money-collect.cfm`'s
// `groups="WEBSITE_ADMINISTRATOR,ADMINISTRATOR"`, same mapping as the other parcels reports.
const ALLOWED_ROLES = ['BemaStandard', 'BemaAdministrator'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...ALLOWED_ROLES]);
  if (auth.response) return auth.response;

  const parsed = moneyCollectQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const start = new Date(`${parsed.data.dateStart}T00:00:00.000Z`);
  const end = new Date(`${parsed.data.dateEnd}T23:59:59.000Z`);

  const report = await getMoneyCollectReport({ start, end }, parsed.data.country);
  return NextResponse.json(report);
}
