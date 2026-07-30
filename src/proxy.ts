import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Matches every route except static files, Next internals, and `/bema` — those don't need
  // locale detection. `/bema` is a separate, non-locale-prefixed route tree (own root
  // layout, see docs/decisions/0011-bema-admin.md); without this exclusion next-intl
  // rewrites `/bema/...` to `/en/bema/...`, which doesn't exist, and every bema route 404s.
  //
  // Static files are excluded by a specific extension list, not a blanket "any dot in the
  // path" pattern (`.*\.` would also exclude `.html` — every Site Pages CMS URL is
  // `<slug>.html` by design, matching the legacy site's URLs for SEO, see
  // docs/decisions/0013-site-pages-cms.md — so a bare dot-exclusion 404s all of them; this
  // broke `/parcel-service.html` etc. the first time around). List covers everything
  // actually under public/ (css/images/fonts) plus the other common static-asset types.
  matcher: [
    '/((?!api|_next|_vercel|bema|.*\\.(?:css|js|mjs|json|png|jpe?g|gif|svg|webp|avif|ico|psd|woff2?|ttf|eot|map|txt|xml|pdf)$).*)',
  ],
};
