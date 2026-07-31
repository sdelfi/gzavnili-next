import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { pricingRuleSchema } from '@/lib/validation/userSchema';
import { findOverlappingActiveRule, OVERLAP_MESSAGE } from '@/lib/services/pricingRuleOverlap';

// "Pricing Rules (Custom Rates & Discounts)" on the legacy "Edit Customer" screen — see
// prisma/schema.prisma's `CustomerPricingRule` doc comment. Same allow-list as the parent
// user-edit screen; there's no separate legacy permission for this sub-section.
const EDIT_ROLES = ['BemaStandard', 'BemaAdministrator', 'BemaAgent'] as const;

// Legacy's backing endpoint (`ajax/pricing/getRules.cfm`) has no IsActive filter — it always
// returns every rule (active, deactivated, expired) and lets the client decide what to show
// via the "Show All Rules" toggle. No server-side `activeOnly` filtering here for the same
// reason.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...EDIT_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;

  const rules = await db.customerPricingRule.findMany({
    where: { userId: id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ rules });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBemaSession(request, [...EDIT_ROLES]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = pricingRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { validFrom, validTo, ...rest } = parsed.data;
  const parsedValidFrom = new Date(validFrom);
  const parsedValidTo = validTo ? new Date(validTo) : null;

  const overlapping = await findOverlappingActiveRule({
    userId: id,
    serviceType: rest.serviceType,
    validFrom: parsedValidFrom,
    validTo: parsedValidTo,
  });
  if (overlapping) {
    return NextResponse.json({ error: OVERLAP_MESSAGE }, { status: 409 });
  }

  const actingAdmin = await db.user.findUnique({ where: { id: auth.session.sub }, select: { username: true } });

  const rule = await db.customerPricingRule.create({
    data: {
      ...rest,
      userId: id,
      validFrom: parsedValidFrom,
      validTo: parsedValidTo,
      createdBy: actingAdmin?.username,
      updatedBy: actingAdmin?.username,
    },
  });

  return NextResponse.json({ rule }, { status: 201 });
}
