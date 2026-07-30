import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';

const EDIT_ROLES = ['BemaStandard', 'BemaAdministrator', 'BemaAgent'] as const;

// Legacy screen's "Actions" column only ever offered removing a rule (there's no separate
// edit-in-place flow shown) — matches that: delete only, not update.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; ruleId: string }> }) {
  const auth = await requireBemaSession(request, [...EDIT_ROLES]);
  if (auth.response) return auth.response;

  const { id, ruleId } = await params;
  const rule = await db.customerPricingRule.findUnique({ where: { id: ruleId } });
  if (!rule || rule.userId !== id) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  await db.customerPricingRule.delete({ where: { id: ruleId } });
  return NextResponse.json({ ok: true });
}
