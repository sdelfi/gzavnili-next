import { defineRouting } from 'next-intl/routing';

// Locale ids match the legacy site's own convention (`session.language` was literally "en"/
// "ge" in the CFML app — see `../http/views/layouts/new.html`), not the ISO 639-1 code for
// Georgian ("ka") — so the URL prefix stays `/ge/...`, identical to what routes.ts and the
// legacy site already used, instead of introducing a second, different-looking prefix.
export const routing = defineRouting({
  locales: ['en', 'ge'],
  defaultLocale: 'en',
  // English stays unprefixed ("/"), Georgian gets "/ge/..." — matches the legacy site exactly
  // (see PageDAO's `pageUrl = "/#left(session.language,2)##pageUrl#"` for non-English).
  localePrefix: 'as-needed',
});
