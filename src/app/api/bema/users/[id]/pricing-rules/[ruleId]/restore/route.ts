import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { findOverlappingActiveRule, OVERLAP_MESSAGE } from '@/lib/services/pricingRuleOverlap';

const EDIT_ROLES = ['BemaStandard', 'BemaAdministrator', 'BemaAgent'] as const;

// Legacy's "Restore" (`ajax/pricing/restoreRule.cfm` → `activatePricingRule`) flips a
// deactivated rule back to active — but the DB trigger re-runs the overlap check on this
// UPDATE too, so restoring into a slot another active rule now occupies still fails with the
// same "Cannot create overlapping..." error. Same check as create, run again here.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; ruleId: string }> }) {
  const auth = await requireBemaSession(request, [...EDIT_ROLES]);
  if (auth.response) return auth.response;

  const { id, ruleId } = await params;
  const rule = await db.customerPricingRule.findUnique({ where: { id: ruleId } });
  if (!rule || rule.userId !== id) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const overlapping = await findOverlappingActiveRule({
    userId: id,
    serviceType: rule.serviceType,
    validFrom: rule.validFrom,
    validTo: rule.validTo,
    excludeRuleId: ruleId,
  });
  if (overlapping) {
    return NextResponse.json({ error: OVERLAP_MESSAGE }, { status: 409 });
  }

  const actingAdmin = await db.user.findUnique({ where: { id: auth.session.sub }, select: { username: true } });

  await db.customerPricingRule.update({
    where: { id: ruleId },
    data: {
      isActive: true,
      deletedAt: null,
      deletedBy: null,
      updatedBy: actingAdmin?.username,
    },
  });
  return NextResponse.json({ ok: true });
}
