import { NextRequest, NextResponse } from 'next/server';
import { requireBemaSession } from '@/lib/auth/session';
import { saveParcelBatch } from '@/lib/services/parcelBatchAdd';
import { trackingNumExists } from '@/lib/services/parcelUpdate';
import { addParcelBatchSchema } from '@/lib/validation/parcelBatchSchema';
import { flattenIssues } from '@/lib/validation/zodErrors';

// The batch "Add Parcel" screen's submit — `bema/parcels/parcels-add.cfm`'s POST branch.
// Same allow-list as the single-parcel edit/create screen.
const EDIT_ROLES = ['BemaStandard', 'BemaAdministrator', 'BemaAgent'] as const;

export async function POST(request: NextRequest) {
  const auth = await requireBemaSession(request, [...EDIT_ROLES]);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = addParcelBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: flattenIssues(parsed.error) }, { status: 400 });
  }

  // Tracking numbers must be unique against existing parcels, and against each other within
  // this same batch (the client's own draft-table check catches the latter first, but a
  // second tab could race it).
  const seen = new Set<string>();
  for (let i = 0; i < parsed.data.draftParcels.length; i++) {
    const trackingNum = parsed.data.draftParcels[i].trackingNum.trim().toUpperCase();
    if (seen.has(trackingNum) || (await trackingNumExists(trackingNum))) {
      return NextResponse.json(
        {
          error: {
            formErrors: [],
            fieldErrors: { [`draftParcels.${i}.trackingNum`]: ['Tracking # is already in use.'] },
          },
        },
        { status: 409 },
      );
    }
    seen.add(trackingNum);
  }

  const { parcels } = await saveParcelBatch(parsed.data);
  return NextResponse.json({ parcels }, { status: 201 });
}
