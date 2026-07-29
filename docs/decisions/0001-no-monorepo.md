# 0001 — No monorepo, no separate backend service

**Status:** confirmed, carried over from pre-implementation scoping.

## Decision

`gzavnili-next` stays a single Next.js app. The API layer is Next.js Route Handlers
(`app/api/**/route.ts`) running in-process — there is no separate `/backend` service and no
monorepo split into `/backend`, `/api`, `/web` packages.

## Why

Recorded in [`migrations/03-target-architecture.md`](migrations/03-target-architecture.md) §2
before implementation started: the legacy codebase shows no evidence of a large engineering
team or a scale problem that a separate service would solve, and a split adds deployment/ops
overhead (two deploy targets, cross-service auth, a shared-types package to keep in sync)
without a corresponding win. Auth is two independent realms (customer vs. bema admin) handled
via route groups + JWT in API route handlers, not via separate services (§3 of the same doc).

## How to apply

- New backend logic (parcels, auth, admin, webhooks) goes in `app/api/**/route.ts` inside this
  repo, following the route-group layout in `migrations/03-target-architecture.md` §1.
- Revisit only if a concrete scaling need emerges (e.g. the bema CSV export needing a
  dedicated worker/queue — already anticipated in §5 of that doc as an async job, not a
  reason to split the service).
- If this changes, update this file and `README.md`'s Stack section together — don't let them
  drift.
