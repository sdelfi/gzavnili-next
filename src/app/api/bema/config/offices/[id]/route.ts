import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { deliveryOfficeSchema } from '@/lib/validation/deliveryOfficeSchema';

const EDIT_ROLES = ['BemaAdministrator', 'BemaAgent'] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...EDIT_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const office = await db.deliveryOffice.findUnique({ where: { id } });
  if (!office) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  return NextResponse.json({ office });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...EDIT_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = deliveryOfficeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await db.deliveryOffice.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const letterTaken = await db.deliveryOffice.findFirst({ where: { letter: parsed.data.letter, id: { not: id } } });
  if (letterTaken) {
    return NextResponse.json({ error: { fieldErrors: { letter: ['Letter is already in use.'] } } }, { status: 400 });
  }

  // Every save wipes `searchPatterns` back to null — legacy's own `form.searchPatterns`
  // always resolves to `""` (the field is commented out of the edit form too), and
  // `deliveryOfficeDAO.update()` writes it unconditionally on every save. Reproduced as-is,
  // not "fixed" into a no-op that would leave a pre-existing value alone. See docs/findings.md.
  const updated = await db.deliveryOffice.update({
    where: { id },
    data: { ...parsed.data, searchPatterns: null },
  });

  return NextResponse.json({ office: updated });
}
