import { NextRequest, NextResponse } from 'next/server';
import { AuthError, loginBemaUser } from '@/lib/auth/login';
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt';
import { setAuthCookies } from '@/lib/auth/cookies';
import { publicUser } from '@/lib/auth/publicUser';

function clientMeta(request: NextRequest) {
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = request.headers.get('user-agent');
  return { ipAddress, userAgent };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.username !== 'string' || typeof body.password !== 'string') {
    return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
  }

  try {
    const user = await loginBemaUser({ username: body.username, password: body.password, ...clientMeta(request) });
    const payload = { sub: user.id, role: user.adminRole! };
    const [accessToken, refreshToken] = await Promise.all([signAccessToken(payload), signRefreshToken(payload)]);

    const response = NextResponse.json({ user: publicUser(user) });
    setAuthCookies(response, { accessToken, refreshToken });
    return response;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 401 });
    }
    throw err;
  }
}
