import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Matches every route except static files, Next internals, the ones we already serve
  // straight out of public/ (images/css/fonts/etc.), and `/bema` — those don't need locale
  // detection. `/bema` is a separate, non-locale-prefixed route tree (own root layout, see
  // docs/decisions/0011-bema-admin.md); without this exclusion next-intl rewrites
  // `/bema/...` to `/en/bema/...`, which doesn't exist, and every bema route 404s.
  matcher: ['/((?!api|_next|_vercel|bema|.*\\..*).*)'],
};
