import { NextRequest, NextResponse } from 'next/server';
import { requireBemaSession } from '@/lib/auth/session';
import { AuthError, loginBemaUser } from '@/lib/auth/login';
import { collectMoneySchema } from '@/lib/validation/moneyCollectSchema';
import { collectMoney } from '@/lib/services/moneyCollect';

// legacy `bema/ajax/moneyCollect.cfm` — the "Collect Money" modal's submit target. Two
// differences from a literal port, both deliberate and documented in docs/findings.md:
//
//  * Legacy has **no** `require.cfm` session/role gate on this endpoint at all — only the
//    inline password re-auth below. Requiring a valid bema session first (same roles as the
//    report page) closes what would otherwise be an unauthenticated write endpoint; this is a
//    security hardening, not a business-logic change, so it's kept despite the "port bugs,
//    don't fix them" rule.
//  * Legacy's password re-auth calls `userDAO.validateLogin(collectorId, password,
//    GROUPS.WEBSITE_ADMINISTRATOR)`, but that function's group-membership check is dead code
//    (commented out in MSSQLUserDAO.cfc) — at runtime it validates *any* active bema admin
//    account's credentials, regardless of role. `loginBemaUser` (the same function the actual
//    login screen uses) matches that real behavior exactly: it only requires `adminRole` to be
//    set, not a specific one.
const ALLOWED_ROLES = ['BemaStandard', 'BemaAdministrator'] as const;

function clientMeta(request: NextRequest) {
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = request.headers.get('user-agent');
  return { ipAddress, userAgent };
}

export async function POST(request: NextRequest) {
  const auth = await requireBemaSession(request, [...ALLOWED_ROLES]);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = collectMoneySchema.safeParse(body);
  if (!parsed.success) {
    // legacy's `writeoutput(3)` ("Invalid Params") for a missing password/aTotal/collectorId/cDate.
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 });
  }
  const input = parsed.data;

  try {
    await loginBemaUser({ username: input.collectorUsername, password: input.password, ...clientMeta(request) });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'wrong_password' }, { status: 401 });
    }
    throw err;
  }

  await collectMoney({
    userId: input.userId,
    cDate: input.cDate,
    aCash: input.aCash,
    aCreditCard: input.aCreditCard,
    aBankDeposit: input.aBankDeposit,
    aWireTransfer: input.aWireTransfer,
    collected: input.aTotal,
    collectorUsername: input.collectorUsername,
    gDate: input.gDate,
  });

  return NextResponse.json({ ok: true });
}
