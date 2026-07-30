import { cookies } from 'next/headers';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS_PERSISTENT,
  REFRESH_TOKEN_TTL_SECONDS_SESSION,
} from './customerJwt';

// "gz_" prefix keeps this cookie namespace separate from the bema realm's "bema_" cookies.
export const ACCESS_COOKIE = 'gz_access_token';
export const REFRESH_COOKIE = 'gz_refresh_token';

const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function setAuthCookies(tokens: { accessToken: string; refreshToken: string }, persistent: boolean) {
  const store = await cookies();
  store.set(ACCESS_COOKIE, tokens.accessToken, { ...baseCookieOptions, maxAge: ACCESS_TOKEN_TTL_SECONDS });
  store.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseCookieOptions,
    maxAge: persistent ? REFRESH_TOKEN_TTL_SECONDS_PERSISTENT : REFRESH_TOKEN_TTL_SECONDS_SESSION,
  });
}

export async function clearAuthCookies() {
  const store = await cookies();
  store.set(ACCESS_COOKIE, '', { ...baseCookieOptions, maxAge: 0 });
  store.set(REFRESH_COOKIE, '', { ...baseCookieOptions, maxAge: 0 });
}

export async function readAccessToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value;
}
