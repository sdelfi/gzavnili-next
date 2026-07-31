import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';

const EDIT_ROLES = ['BemaStandard', 'BemaAdministrator', 'BemaAgent'] as const;

// Legacy screen's "Actions" column only ever offered removing a rule (there's no separate
// edit-in-place flow shown) — matches that: no update endpoint. But "removing" in legacy
// (`MSSQLCustomerPricingRuleDAO.deactivatePricingRule`) is a soft delete — IsActive=0 plus
// DeletedDate/DeletedBy — never a real row DELETE, so the row (and its "Restore" path,
// see `[ruleId]/restore/route.ts`) survives.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; ruleId: string }> }) {
  const auth = await requireBemaSession(request, [...EDIT_ROLES]);
  if (auth.response) return auth.response;

  const { id, ruleId } = await params;
  const rule = await db.customerPricingRule.findUnique({ where: { id: ruleId } });
  if (!rule || rule.userId !== id) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const actingAdmin = await db.user.findUnique({ where: { id: auth.session.sub }, select: { username: true } });
  const now = new Date();

  await db.customerPricingRule.update({
    where: { id: ruleId },
    data: {
      isActive: false,
      deletedAt: now,
      deletedBy: actingAdmin?.username,
      updatedBy: actingAdmin?.username,
    },
  });
  return NextResponse.json({ ok: true });
}
