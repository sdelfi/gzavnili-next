import { NextRequest, NextResponse } from 'next/server';
import { requireBemaSession } from '@/lib/auth/session';
import { saveQuickCustomer } from '@/lib/services/parcelBatchCustomer';
import { quickCustomerSchema } from '@/lib/validation/parcelBatchSchema';
import { flattenIssues } from '@/lib/validation/zodErrors';

// The batch "Add Parcel" screen's customer box "Save"/"Update" button — `bema/ajax/
// customerEdit.cfm`. Same allow-list as the parcel edit/create screens.
const EDIT_ROLES = ['BemaStandard', 'BemaAdministrator', 'BemaAgent'] as const;

export async function POST(request: NextRequest) {
  const auth = await requireBemaSession(request, [...EDIT_ROLES]);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = quickCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: flattenIssues(parsed.error) }, { status: 400 });
  }

  try {
    const { id } = await saveQuickCustomer(parsed.data);
    return NextResponse.json({ userId: id }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: { formErrors: [err instanceof Error ? err.message : 'Save failed.'], fieldErrors: {} } },
      { status: 409 },
    );
  }
}
