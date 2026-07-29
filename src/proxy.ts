import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Matches every route except static files, Next internals, and the ones we already serve
  // straight out of public/ (images/css/fonts/etc.) — those don't need locale detection.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
