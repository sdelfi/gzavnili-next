import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { listAllPricingRulesQuerySchema } from '@/lib/validation/userSchema';

// "Pricing Rules Administration" — legacy `pricing_global_rules.cfm`, gated to
// `session.buser.getGroupId() eq 10` (the legacy admin-only group). `BemaAdministrator` is
// the closest analog in this app's flatter role model (see `AdminRole`'s doc comment) —
// stricter than the per-customer pricing-rules routes, which any of the three roles can use.
const LIST_ROLES = ['BemaAdministrator'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...LIST_ROLES]);
  if (auth.response) return auth.response;

  const parsed = listAllPricingRulesQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { serviceType, mode, validFromFrom, validFromTo, customerId, activeOnly, page, perPage } = parsed.data;

  const where: Prisma.CustomerPricingRuleWhereInput = {
    ...(activeOnly === 'true' ? { isActive: true } : {}),
    ...(serviceType ? { serviceType } : {}),
    ...(mode ? { mode } : {}),
    ...(customerId ? { userId: customerId } : {}),
    ...(validFromFrom || validFromTo
      ? {
          validFrom: {
            ...(validFromFrom ? { gte: new Date(validFromFrom) } : {}),
            ...(validFromTo ? { lte: new Date(validFromTo) } : {}),
          },
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    db.customerPricingRule.count({ where }),
    // Matches legacy's `ORDER BY CreatedDate DESC` (not StartDate) in `getAllRulesGlobal.cfm`.
    db.customerPricingRule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { user: { select: { id: true, firstName: true, lastName: true, username: true } } },
    }),
  ]);

  return NextResponse.json({ items, total, page, perPage });
}
