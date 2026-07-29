# 0005 — Header personalization: plain dynamic SSR, not Cache Components/PPR

**Status:** confirmed, implemented. **Revised** — the original version of this decision (enable
`cacheComponents: true` + a Suspense-streamed `HeaderPersonalized`) was tried, shipped, and then
reverted after it caused a real, visible regression: see "Why the PPR version was reverted"
below. Keeping the full history here since the mistake is worth not repeating.

## Problem

The header's office-selection + "Open Now"/"Closed Now" badge needs the visitor's real
wall-clock time and their saved office choice. Originally this was computed entirely
client-side in a `useEffect`, starting hidden/default and popping in after mount — a visible
flash on every load. `localStorage` wouldn't fix that either: it isn't readable during server
rendering, so the mismatch/flash would remain regardless; only a cookie can be read server-side
before first paint.

## Decision (current)

Read the office cookie directly in an async Server Component (`Header.tsx`), with **no**
`cacheComponents`/Suspense-streaming involved — just a plain dynamic (per-request) render:

- `src/lib/preferences.ts` — `getPreferredOfficeId()`, reads the `office` cookie via
  `next/headers`, defaults to `"tbilisi"`.
- `src/lib/offices.ts` — the shared `OFFICES` directory + `setOfficeCookie()` (client-side
  write on selection). Kept separate from `preferences.ts` because a `"use client"` file
  (`HeaderClient.tsx`) needs `OFFICES`/`setOfficeCookie` but must never import anything that
  pulls in `next/headers`.
- `Header.tsx` — `async function Header()`, reads the cookie, computes `isOfficeOpen()`, and
  renders `<HeaderClient initialOfficeId=... initialOfficeOpenNow=... />` — a single, complete,
  correct render. No fallback state, no swap.

Because `Header` sits in the root layout, this makes **every route dynamically rendered**
(`ƒ` in `next build`'s output, not `○`/`◐`) — the whole "Phase 2 public static site" goal from
`migrations/03-target-architecture.md` is, for now, "fast per-request SSR" rather than
build-time static generation. Accepted trade-off: see below.

The office cookie is intentionally **not httpOnly** — it's a display preference, not a secret,
and needs to be both written and (for the client-side 60s freshness tick) read from the browser.

## Why the PPR version was reverted

The first version of this decision enabled `cacheComponents: true` and wrapped a cookie-reading
`HeaderPersonalized` in `<Suspense>`, specifically to *keep* static generation for the rest of
the page while only that subtree was dynamic. It worked exactly as PPR is documented to work —
and that was the problem: PPR **always** ships the prerendered (build-time) Suspense fallback
as the first flush of the response, then streams the real dynamic content in a second flush.
For a visitor who'd previously picked "New York," that meant every single reload visibly showed
**"Tbilisi" (the fallback's hardcoded default) and then changed to "New York"** a moment later
— a wrong-then-right flash, which is worse than the original hidden-then-shown flash we set out
to fix, because now the *wrong specific data* is what's shown first. Reported directly by the
client as "не айс." There's no fallback content that avoids this for a personalization that
affects an identity/name (as opposed to e.g. a boolean badge) — the fallback is static by
definition and can't know the visitor's cookie.

Plain dynamic SSR doesn't have a fallback/swap step at all: one render, done once the cookie is
known, sent as the only response. It's the more boring choice and the correct one here.

## Accepted trade-off: no static generation for the public site (for now)

Every route drops from static (`○`) to dynamic (`ƒ`) because of this. In practice the added
work per request is a cookie read + a synchronous timezone calculation — no DB/network I/O —
so response time is still fast, especially self-hosted on our own VDS (no serverless cold
starts to worry about, per `docs/decisions/0004-scheduled-jobs.md`'s hosting constraint). The
loss is CDN-level edge caching of byte-identical HTML for anonymous visitors, which matters
more at a scale this site isn't at yet. Revisit only if real traffic/latency numbers say so —
if it ever does, the fix is to scope personalization to a small island again, but skip the
Suspense-fallback pitfall by rendering a **content-neutral** fallback (no specific office name
asserted, just a loading state) rather than a wrong specific default.

## Gotchas hit while implementing (useful if this pattern gets reused elsewhere)

- A value read from `cookies()` can't be imported into a `"use client"` file even indirectly —
  `src/lib/preferences.ts` (imports `next/headers`) must never be imported, even for an
  unrelated constant, from anything client-side. Constants shared by both sides (`OFFICES`,
  `OFFICE_COOKIE`, `setOfficeCookie`) live in `src/lib/offices.ts` instead, which has no
  server-only imports.
- Writing `document.cookie = ...` directly inside a component's event handler trips
  `react-hooks/immutability` (a React-Compiler-safety lint rule: mutating a reference captured
  from outside the component). Moved the write into a standalone module-level function
  (`setOfficeCookie` in `offices.ts`) instead of inlining it in the click handler.
