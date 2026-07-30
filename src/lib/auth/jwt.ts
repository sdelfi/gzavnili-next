import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import type { AdminRole } from '@/generated/prisma/client';

// Separate secret/cookie/token namespace from any future customer-facing auth — "two
// independent auth realms," per docs/migrations/03-target-architecture.md §3. Never share
// this secret with a customer-auth implementation added later.
const secretEnv = process.env.BEMA_AUTH_SECRET;
if (!secretEnv) {
  throw new Error('BEMA_AUTH_SECRET is not set — see .env.example.');
}
const secret = new TextEncoder().encode(secretEnv);

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export type BemaTokenPayload = {
  sub: string;
  role: AdminRole;
};

async function sign(payload: BemaTokenPayload, ttlSeconds: number, tokenType: 'access' | 'refresh') {
  return new SignJWT({ ...payload, type: tokenType })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(secret);
}

export const signAccessToken = (payload: BemaTokenPayload) => sign(payload, ACCESS_TOKEN_TTL_SECONDS, 'access');
export const signRefreshToken = (payload: BemaTokenPayload) => sign(payload, REFRESH_TOKEN_TTL_SECONDS, 'refresh');

async function verify(token: string, tokenType: 'access' | 'refresh'): Promise<BemaTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.type !== tokenType || typeof payload.sub !== 'string' || typeof payload.role !== 'string') {
      return null;
    }
    return { sub: payload.sub, role: payload.role as AdminRole };
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired || err instanceof joseErrors.JWSSignatureVerificationFailed) {
      return null;
    }
    return null;
  }
}

export const verifyAccessToken = (token: string) => verify(token, 'access');
export const verifyRefreshToken = (token: string) => verify(token, 'refresh');
