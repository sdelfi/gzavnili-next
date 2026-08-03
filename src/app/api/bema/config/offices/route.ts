import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { deliveryOfficeSchema, listDeliveryOfficesQuerySchema } from '@/lib/validation/deliveryOfficeSchema';

// bema "Georgian Offices" (`bema/config/offices.cfm`) — see
// docs/decisions/0030-georgian-offices.md. Legacy's own `groups="WEBSITE_ADMINISTRATOR,
// ADMINISTRATOR"` on the *list* screen is narrower than `office_edit.cfm`'s
// `...,AGENT_ADMINISTRATOR` — a real mismatch (an agent can reach the edit form directly by
// id but never browse to it), reproduced as two different role sets rather than unified.
const LIST_ROLES = ['BemaAdministrator'] as const;
const EDIT_ROLES = ['BemaAdministrator', 'BemaAgent'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...LIST_ROLES]);
  if (auth.response) return auth.response;

  const parsed = listDeliveryOfficesQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { page, perPage, search, active, sort, dir } = parsed.data;

  // Legacy ANDs a `city LIKE` and a `searchPatterns LIKE` condition for *every* space-
  // separated keyword — not ORs them — so a keyword only matches a row whose `searchPatterns`
  // also contains it. Since `searchPatterns` has no editable field anywhere in this screen
  // (see the decision doc), this reproduces legacy's own effectively-dead keyword search
  // rather than "fixing" it into a working city-only search. See docs/findings.md.
  const keywordFilters = (search ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => ({
      AND: [
        { city: { contains: term, mode: 'insensitive' as const } },
        { searchPatterns: { contains: term, mode: 'insensitive' as const } },
      ],
    }));

  const where = {
    ...(active ? { active: active === '1' } : {}),
    AND: keywordFilters,
  };

  const [total, items] = await Promise.all([
    db.deliveryOffice.count({ where }),
    db.deliveryOffice.findMany({
      where,
      orderBy: { [sort]: dir },
      skip: (page - 1) * perPage,
      take: perPage,
      select: { id: true, city: true, officeName: true, officeNameGe: true, letter: true, active: true },
    }),
  ]);

  return NextResponse.json({ items, total, page, perPage });
}

export async function POST(request: NextRequest) {
  const auth = await requireBemaSession(request, [...EDIT_ROLES]);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = deliveryOfficeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const letterTaken = await db.deliveryOffice.findFirst({ where: { letter: parsed.data.letter } });
  if (letterTaken) {
    return NextResponse.json({ error: { fieldErrors: { letter: ['Letter is already in use.'] } } }, { status: 400 });
  }

  // `searchPatterns` is always written as null here, matching legacy's own always-blank
  // `form.searchPatterns` on create (the field is commented out of the form) — see
  // docs/findings.md.
  const created = await db.deliveryOffice.create({ data: { ...parsed.data, searchPatterns: null } });

  return NextResponse.json({ office: created }, { status: 201 });
}
