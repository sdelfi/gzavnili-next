# 0005 — Cache Components (`cacheComponents: true`) for personalized-but-mostly-static pages

**Status:** confirmed, implemented (`next.config.ts`, `src/components/Header.tsx` +
`HeaderPersonalized.tsx` + `HeaderClient.tsx`, `src/lib/preferences.ts`).

## Problem

The header's office-selection + "Open Now"/"Closed Now" badge needs the visitor's real
wall-clock time and (going forward) their saved office choice. It was previously computed
entirely client-side in a `useEffect`, starting hidden and popping in after mount — a visible
flash on every load. Storing the selection in `localStorage` (as briefly considered) wouldn't
fix that: `localStorage` isn't readable during server rendering at all, so the mismatch/flash
would remain; only a cookie can be read server-side before first paint.

Naively reading a cookie via `next/headers`'s `cookies()` in a Server Component under the
*classic* Next.js rendering model forces the **entire route** to render dynamically (no static
generation) — since `Header` sits in the root layout, that would make every public page dynamic
on every request, undoing the SSG posture this project has otherwise committed to (see
`migrations/03-target-architecture.md`).

## Decision

Enable **Cache Components** (`cacheComponents: true` in `next.config.ts`) — Next 16's current
model (this is "NOT the Next.js you know", per `AGENTS.md`; this flag was `experimental.ppr` in
Next 15 and is now the stable, unified way to mix static and dynamic content in the same route).
Under this model, a Server Component that calls a runtime API (`cookies()`, `headers()`, etc.)
only opts *itself* out of the static shell, as long as it sits inside a `<Suspense>` boundary —
everything else in the route stays part of the prerendered static HTML.

Concretely:

- `Header.tsx` — plain Server Component, no runtime APIs, wraps `<HeaderPersonalized />` in
  `<Suspense fallback={<HeaderClient initialOfficeOpenNow={null} .../>}>`.
- `HeaderPersonalized.tsx` — async Server Component, the only place that calls `cookies()`
  (via `src/lib/preferences.ts`); computes the real `isOfficeOpen()` value and hands it to...
- `HeaderClient.tsx` — the client-interactive half (dropdowns, modals), now driven by initial
  props instead of computing everything itself post-mount. Office switching still writes a
  cookie client-side (`src/lib/offices.ts`'s `setOfficeCookie`) so the next full page load's
  `HeaderPersonalized` picks it up.

The office cookie is intentionally **not httpOnly** — it's a display preference, not a secret,
and needs to be both written and (for the client-side 60s freshness tick) read from the
browser.

## Gotchas hit while implementing (useful if this pattern gets reused elsewhere)

- `new Date()` (or `Math.random()`/`crypto.randomUUID()`) can't be called during prerendering
  without either a runtime API already in scope (e.g. after `cookies()`) or explicit
  `connection()` — Next's build fails with `next-prerender-current-time` otherwise. Hit this
  twice: the Suspense *fallback* (prerendered at build time, can't know real time — solved by
  passing `initialOfficeOpenNow: null` and hiding both badges in that state) and `Footer.tsx`'s
  `{new Date().getFullYear()}` (solved with a file-level `"use cache"` directive instead —
  the year only needs to be right to within a cache revalidation, not per-request).
- A value read from `cookies()` can't be imported into a `"use client"` file even indirectly —
  `src/lib/preferences.ts` (which imports `next/headers`) must not be imported, even for an
  unrelated constant, from anything client-side. Constants shared by both sides (`OFFICES`,
  `OFFICE_COOKIE`) live in `src/lib/offices.ts` instead, which has no server-only imports.

## How to apply elsewhere

Any other personalization that needs to be correct on first paint (not just this header) should
follow the same shape: a small async Server Component reading the runtime API, wrapped in
`<Suspense>`, handing plain props down to a client component — not a page-wide `dynamic =
"force-dynamic"`, which would give up static generation for content that's 99% not personalized.
