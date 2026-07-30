import type { NextRequest, NextResponse } from 'next/server';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from './jwt';

// "bema_" prefix keeps this cookie namespace separate from any future customer-facing
// auth — see docs/migrations/03-target-architecture.md §3, "two independent auth realms."
export const ACCESS_COOKIE = 'bema_access_token';
export const REFRESH_COOKIE = 'bema_refresh_token';

const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export function setAuthCookies(response: NextResponse, tokens: { accessToken: string; refreshToken: string }) {
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...baseCookieOptions,
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseCookieOptions,
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, '', { ...baseCookieOptions, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, '', { ...baseCookieOptions, maxAge: 0 });
}

export function readAccessToken(request: NextRequest): string | undefined {
  return request.cookies.get(ACCESS_COOKIE)?.value;
}

export function readRefreshToken(request: NextRequest): string | undefined {
  return request.cookies.get(REFRESH_COOKIE)?.value;
}
