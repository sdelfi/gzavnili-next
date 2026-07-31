import { NextRequest, NextResponse } from 'next/server';
import { requireBemaSession } from '@/lib/auth/session';
import { parcelOperationSchema } from '@/lib/validation/parcelSchema';
import { runParcelOperation } from '@/lib/services/parcelOperations';

// Legacy `bema/parcels/parcels-operation.cfm` guards these with
// `WEBSITE_ADMINISTRATOR,ADMINISTRATOR` — a strictly narrower list than the read-only screen
// that links to it, and the list screen hides the whole operations toolbar from agents.
const OPERATION_ROLES = ['BemaStandard', 'BemaAdministrator'] as const;

export async function POST(request: NextRequest) {
  const auth = await requireBemaSession(request, [...OPERATION_ROLES]);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = parcelOperationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await runParcelOperation(parsed.data);
  return NextResponse.json(result);
}
