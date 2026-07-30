import { NextRequest, NextResponse } from 'next/server';
import { readRefreshToken, setAuthCookies, clearAuthCookies } from '@/lib/auth/cookies';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/lib/auth/jwt';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  const token = readRefreshToken(request);
  const payload = token ? await verifyRefreshToken(token) : null;
  if (!payload) {
    const response = NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }

  const user = await db.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.accountType !== 'BemaUser' || !user.active || !user.adminRole) {
    const response = NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }

  // Rotate both tokens on every refresh (sliding session, and limits a stolen refresh
  // token's usable lifetime to one round-trip before it's superseded).
  const newPayload = { sub: user.id, role: user.adminRole };
  const [accessToken, refreshToken] = await Promise.all([signAccessToken(newPayload), signRefreshToken(newPayload)]);

  const response = NextResponse.json({ ok: true });
  setAuthCookies(response, { accessToken, refreshToken });
  return response;
}
