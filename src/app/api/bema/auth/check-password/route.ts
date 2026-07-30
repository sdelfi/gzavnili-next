import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { verifyPassword } from '@/lib/auth/password';
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt';
import { setAuthCookies } from '@/lib/auth/cookies';

const BEMA_ROLES = ['BemaStandard', 'BemaAdministrator', 'BemaAgent'] as const;

// Backs the idle-lock modal (`IdleModal`) — mirrors the legacy
// `http/bema/ajax/checkPassword.cfm` exactly:
//   1. First tries the entered value as another active BemaUser's *short* password
//      (`validatePasswordShort`) — a match switches the session to that user (result 2),
//      used to hand off a shared terminal between agents without a full logout/login.
//   2. If no short-password match, falls back to checking it as the *current* session
//      user's full password (result 1).
//   3. Anything else is a wrong password (result 0).
// Legacy does the short-password lookup via a bare SQL equality scan since PasswordShort is
// stored in plaintext there; we store it hashed (passwordShortHash) so the equivalent is an
// active-candidate scan verifying each hash in turn — see prisma/schema.prisma's comment on
// `passwordShortHash` and docs/decisions/0011-bema-admin.md.
export async function POST(request: NextRequest) {
  const auth = await requireBemaSession(request, [...BEMA_ROLES]);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.password !== 'string' || !body.password) {
    return NextResponse.json({ result: 0 });
  }
  const { password } = body;

  if (password.length > 2) {
    const candidates = await db.user.findMany({
      where: { accountType: 'BemaUser', active: true, passwordShortHash: { not: null } },
      select: { id: true, adminRole: true, passwordShortHash: true },
    });
    for (const candidate of candidates) {
      if (!candidate.passwordShortHash) continue;
      const matches = await verifyPassword(password, candidate.passwordShortHash, 'argon2id');
      if (!matches) continue;

      if (candidate.id === auth.session.sub) {
        return NextResponse.json({ result: 1 });
      }
      const payload = { sub: candidate.id, role: candidate.adminRole! };
      const [accessToken, refreshToken] = await Promise.all([signAccessToken(payload), signRefreshToken(payload)]);
      const response = NextResponse.json({ result: 2 });
      setAuthCookies(response, { accessToken, refreshToken });
      return response;
    }
  }

  const sessionUser = await db.user.findUnique({ where: { id: auth.session.sub } });
  const passwordOk =
    sessionUser?.passwordHash && (await verifyPassword(password, sessionUser.passwordHash, sessionUser.passwordAlgo));

  return NextResponse.json({ result: passwordOk ? 1 : 0 });
}
