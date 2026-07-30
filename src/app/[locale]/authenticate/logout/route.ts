import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/auth/customerCookies';

// GET, matching the legacy `Authenticate.doLogout` (a plain link, not a form) — supports an
// optional `?ret=` to return somewhere specific, same as legacy. Clears cookies directly on
// the redirect `NextResponse` (rather than via customerCookies.ts's `next/headers`-based
// helpers, which target Server Action/Server Component contexts) since a Route Handler
// already has a response object to attach them to, same pattern as the bema realm's
// `setAuthCookies(response, ...)`.
export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const ret = request.nextUrl.searchParams.get('ret');
  const response = NextResponse.redirect(new URL(ret || (locale === 'ge' ? '/ge/' : '/'), request.url));
  response.cookies.set(ACCESS_COOKIE, '', { maxAge: 0, path: '/' });
  response.cookies.set(REFRESH_COOKIE, '', { maxAge: 0, path: '/' });
  return response;
}
