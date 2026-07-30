import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';

// Customer-facing auth realm — deliberately separate secret/token namespace from the bema
// realm (docs/migrations/03-target-architecture.md §3, "two independent auth realms").
// Never share `CUSTOMER_AUTH_SECRET` with `BEMA_AUTH_SECRET`.
const secretEnv = process.env.CUSTOMER_AUTH_SECRET;
if (!secretEnv) {
  throw new Error('CUSTOMER_AUTH_SECRET is not set — see .env.example.');
}
const secret = new TextEncoder().encode(secretEnv);

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
// "Remember me" (legacy: a separate `RememberMe` cookie/DB token, 30-day expiry) is
// implemented here as simply a longer-lived refresh cookie — see customerCookies.ts's
// `setAuthCookies` `persistent` flag — rather than a second token/column, since this stack's
// session model is already refresh-token-based (unlike legacy's server session store), so a
// longer refresh cookie is the direct behavioral equivalent.
export const REFRESH_TOKEN_TTL_SECONDS_SESSION = 24 * 60 * 60;
export const REFRESH_TOKEN_TTL_SECONDS_PERSISTENT = 30 * 24 * 60 * 60;

export type CustomerTokenPayload = { sub: string };

async function sign(payload: CustomerTokenPayload, ttlSeconds: number, tokenType: 'access' | 'refresh') {
  return new SignJWT({ ...payload, type: tokenType })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(secret);
}

export const signAccessToken = (payload: CustomerTokenPayload) => sign(payload, ACCESS_TOKEN_TTL_SECONDS, 'access');
export const signRefreshToken = (payload: CustomerTokenPayload, ttlSeconds: number) =>
  sign(payload, ttlSeconds, 'refresh');

async function verify(token: string, tokenType: 'access' | 'refresh'): Promise<CustomerTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.type !== tokenType || typeof payload.sub !== 'string') return null;
    return { sub: payload.sub };
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired || err instanceof joseErrors.JWSSignatureVerificationFailed) {
      return null;
    }
    return null;
  }
}

export const verifyAccessToken = (token: string) => verify(token, 'access');
export const verifyRefreshToken = (token: string) => verify(token, 'refresh');
