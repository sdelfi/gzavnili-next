# 0003 — Mobile API stays inside this Next.js app (no monorepo)

**Status:** confirmed, extends [0001-no-monorepo.md](0001-no-monorepo.md).

## Decision

The API the mobile app talks to is the same Next.js Route Handlers (`app/api/**/route.ts`) that
the web frontend uses — not a separate service, not a separate package. This was already the
plan in [`migrations/06-phased-rollout-plan.md`](../migrations/06-phased-rollout-plan.md) Phase 5:
"only the surviving API variant... gets ported to Next.js Route Handlers."

## Why a public HTTP API doesn't require a monorepo

A monorepo split (`/backend`, `/api`, `/web`) buys you independent deploy/scale of the API vs.
the web frontend, and a place to put backend-only tooling. None of that is needed just because
a *consumer* of the API (the mobile app) happens to live in a different repo/codebase — the
mobile app is simply an HTTP client, same as the browser is. Route Handlers are already
plain HTTP endpoints; nothing about serving them to a mobile client instead of/in addition to
a browser requires restructuring this repo.

## What mobile-as-a-consumer does change (not repo layout — API-level details)

- **Auth**: the web app can use an httpOnly cookie for the refresh token (see
  `migrations/03-target-architecture.md` §3); a native app doesn't get browser-cookie handling
  for free the same way, so the mobile client uses a bearer access token (+ refresh token
  persisted in platform secure storage — Keychain/Keystore), sent as `Authorization: Bearer …`.
  The route handlers need to accept both: cookie *or* bearer, not cookie-only.
- **CORS**: irrelevant for native apps (no browser origin policy), but the API surface is still
  public over the internet, so auth/rate-limiting is what actually protects it — don't rely on
  CORS as a security boundary for any endpoint mobile hits.
- **Versioning matters more here than for the web app**: web ships continuously (every deploy
  reaches 100% of users immediately), but old mobile app builds linger for months (app store
  review latency, users who don't update). Prefix mobile-facing routes `app/api/v1/...` from the
  start and treat any breaking change as `v2`, keeping `v1` alive until old app builds age out —
  unlike the web API, which can change in place.
- **Rate limiting / abuse protection** matters more once endpoints are reachable directly by
  a distributed app install base rather than only same-origin browser fetches — worth a
  lightweight middleware (e.g. IP+token bucket) on the mobile-facing routes when Phase 5 starts.

## When to revisit

If the mobile API genuinely needs independent scaling/deployment from the web app (e.g. very
different traffic profile, need to deploy API fixes without a full web redeploy), that's a
reason to reconsider — but it's a scaling problem to solve if/when it appears, not something to
build defensively now on a codebase with no evidence of that scale yet (same reasoning as
0001).
