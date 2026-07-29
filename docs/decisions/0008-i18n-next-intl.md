# 0008 — i18n via next-intl, locale ids `en`/`ge` matching the legacy site

**Status:** implemented (scaffold + homepage fully wired for both locales).

## Decision

Use [next-intl](https://next-intl.dev) for internationalization, with `[locale]` segment
routing under `src/app/[locale]/`. Locale ids are `en` and `ge` — **not** `ka` (the ISO 639-1
code for Georgian) — matching the legacy site's own convention (`session.language` was
literally `"en"`/`"ge"` in the CFML app; see `../http/views/layouts/new.html`), and consistent
with `src/lib/routes.ts`'s existing `/ge/...` paths. `localePrefix: 'as-needed'` +
`defaultLocale: 'en'`: English stays unprefixed (`/`), Georgian gets `/ge/...` — an exact match
for the legacy URL scheme (`PageDAO`'s `pageUrl = "/#left(session.language,2)##pageUrl#"` for
non-English).

## Why next-intl over a hand-rolled solution

Type-safe (message keys are checked against the JSON shape), first-class App Router support
(Server *and* Client Component translation, via `getTranslations`/`useTranslations`), and
`createNavigation` gives a locale-aware `Link`/`usePathname`/`useRouter` so internal links
don't need manual prefix handling anywhere in components — `src/lib/routes.ts`'s existing
locale-agnostic path helpers (`routes.home()`, `routes.page('faq')`, etc.) keep working
unchanged as the `href` input to that `Link`.

## Structure

- `src/i18n/routing.ts` — `defineRouting({locales: ['en','ge'], defaultLocale: 'en',
  localePrefix: 'as-needed'})`.
- `src/i18n/request.ts` — `getRequestConfig`, loads `messages/<locale>.json`.
- `src/i18n/navigation.ts` — `createNavigation(routing)` → locale-aware `Link`/`usePathname`/etc.
- `src/proxy.ts` — `createMiddleware(routing)`. Named `proxy.ts`, not `middleware.ts` — Next 16
  renamed the file convention (see the "middleware" deprecation warning if you rename it back).
- `src/app/[locale]/layout.tsx` / `page.tsx` — moved from `src/app/` directly; validates the
  segment via `hasLocale` + `notFound()`, wraps children in `NextIntlClientProvider`.
- `messages/en.json`, `messages/ge.json` — one root key per component (`Header`, `Footer`,
  `HomeHero`, `TrustUs`, `SpecialOffer`, `WhyChooseUs`, `Calculator`, `Faq`, `VideoTutorials`,
  `MobileApp`, `News`).

## Where the Georgian strings came from

Not machine-translated: extracted from the legacy app's own real Georgian content —
`../http/include/pages/E4562B44D65122F4B36660EF1DA9F9FE81A58F58.json` (the `PageDAO` cache for
`/ge/index.html`, found the same way as the English homepage cache — see `PROGRESS.md`'s
`home.html` dead-code entry) for the homepage sections, and `../http/views/layouts/new.html`'s
`<cfif session.language eq "ge">` branches for Header/Footer nav labels. `Calculator`'s Georgian
branch (`../http/views/homecals.cfm`) keeps the source's own Latin-script unit abbreviations
(`Lb`/`Kg`/`In`/`Sm`) rather than "correcting" them to Georgian script — that's what the real
site actually shows.

## Known gaps / how to apply going forward

- Only the homepage is wired. Every other page ported later needs the same treatment: add a
  root key to both `messages/*.json` files, pull real Georgian copy from that page's
  `include/pages/*.json` cache (compute the hash the same way — `sha1(pathname)`, upper-hex)
  or its `<cfif session.language eq "ge">` branch in the legacy views, and use
  `getTranslations`/`useTranslations` — never hardcode a string that has a legacy Georgian
  equivalent, and never invent a Georgian translation that doesn't check against a real source.
- Arrays needing an accompanying non-translated value (icons, image paths, embed URLs) use a
  separate positional constant, index-matched to the translated array — see
  `WhyChooseUs.tsx`'s `ICONS`, `VideoTutorials.tsx`'s `VIDEO_META`, `News.tsx`'s `NEWS_IMAGES`.
  Keep the two arrays' order in lockstep if either changes.
- `TrustUs`'s paragraph count differs between locales (English has 4 lead paragraphs + 1
  closing; the real Georgian copy only ever had 2 + 1) — handled with a `paragraphs: string[]`
  array instead of fixed `p1`..`p5` keys precisely so locales aren't forced into the same
  shape.
