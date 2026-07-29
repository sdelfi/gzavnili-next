# 03 — Target Architecture (Next.js)

## 1. App structure

```
app/
  (public)/                    # SSG/ISR route group — no auth, statically generated
    page.tsx                   # home.html equivalent
    services/…, cargo/…, courier/…, pricing/…, faq/…, news/…, legal/…
    tracking/page.tsx          # public unauthenticated tracking lookup:
                                #   page shell is static; the live lookup itself is a client-side
                                #   fetch to an API route (not part of the static build)
  (account)/                   # CSR route group behind auth — replaces /account/*, /checkout/*
    layout.tsx                 # client-side auth guard (checks session via API, redirects if absent)
    orders/, parcels/, statements/, billing/, shipping/, invoices/, receivers/, payments/
  (admin)/                     # bema replacement, CSR, separate auth realm
    parcels/, products/, orders/, users/, statements/, content/, reports/, messages/, config/
    # coupons/ intentionally omitted — out of scope, see 00-overview.md
  api/                         # Next.js Route Handlers = the API layer
    auth/…
    parcels/…
    admin/parcels/…
    webhooks/{paypal,authorizenet,cybersource,payflowpro,sage,internetsecure,gzpay}/route.ts
```

Rationale for route groups: today, the public/authorized boundary is enforced per-method inside shared controller files via the `require.cfm` guard tag (see [01-current-state-audit.md](01-current-state-audit.md) §4), which mixes public and private routes in the same `.cfc` file (e.g. `Static.cfc`, `Account.cfc`). Physically separating `(public)`, `(account)`, `(admin)` as Next.js route groups — each with its own `layout.tsx` enforcing (or not enforcing) auth — fixes this structural smell directly, rather than porting the per-method-guard pattern.

## 2. API layer

Next.js Route Handlers, in-process — not a separate backend service, at least initially. Given the ad hoc nature of the current codebase and no evidence of a large engineering team, a separate service would add deployment/ops overhead without a clear win. Revisit only if the bema admin's reporting queries or CSV export need a dedicated background-job/worker architecture (recommended regardless of API topology — see §5 below).

## 3. Auth strategy

Replace CF native server-side sessions + encrypted "remember me" cookie with **JWT access token + refresh token in an httpOnly cookie**, either custom-rolled (Lucia-style) or via Auth.js/NextAuth with a Credentials provider backed by the new Postgres `users` table.

- **Two independent auth realms**, mirroring today's `session.user` (customer) vs. `session.buser` (bema admin) separation in `http/bema/Application.cfc`: do not share a session cookie/token scope between the customer zone and the admin panel.
- Since neither zone needs SSR, session validation happens inside API route handlers (verify JWT); the client layout does a client-side check (`/api/auth/me`) and redirects if unauthenticated. No need for Next.js middleware-based SSR auth gating — this simplifies the architecture and matches the CSR-only requirement.
- Password hashing: replace the current CF `hashPassword(pw, salt)` scheme with a modern KDF (bcrypt/argon2) as part of the user-record migration; existing password hashes likely cannot be verified by a new algorithm, so plan either a re-hash-on-next-login strategy or a one-time re-hash migration script — flag as an open question in [07-risks-and-open-questions.md](07-risks-and-open-questions.md) pending inspection of the current hashing scheme's exact algorithm.

## 4. Cron / background job replacement

Cron jobs are still required (per client instruction) but should be rebuilt on a modern mechanism rather than ported as CFML scripts. **Superseded by [`../decisions/0004-scheduled-jobs.md`](../decisions/0004-scheduled-jobs.md)** now that hosting is pinned to HestiaCP (not Vercel, which this section originally assumed as a candidate): OS crontab on the host running scripts directly for simple periodic jobs, plus a Postgres-backed queue (not Redis) for anything with retries/backpressure needs (SMS sends, batch status recomputation, data-migration batch jobs).

Jobs to replace, preserving exact business semantics (see [02-parcels-domain-analysis.md](02-parcels-domain-analysis.md) for the semantics each one implements):

- `http/cron/onhold.cfm` → becomes largely unnecessary once hold-flag transitions are recomputed directly by the status trigger on write (see [04-postgres-schema-design.md](04-postgres-schema-design.md)); if a scheduled sweep is still needed (e.g. for cutoff-date-based transitions not triggered by any single row write), rebuild as a scheduled Postgres function call.
- `http/cron/changeParcelStatus.cfm` (Received→Shipped on `TripDate`) → scheduled job calling a Postgres function, logging to the `parcel_status_history` table (replacing the write-only `operations` table).
- SMS/messaging jobs (e.g. `sms_add_bulk.cfm`) → scheduled/queued job reading `parcels.status` directly instead of recomputing it inline.

## 5. Reporting / CSV export redesign

The current bema parcels CSV export requests up to 9,999 rows synchronously through the same `getParcels()` query used for the paginated list (see [02-parcels-domain-analysis.md](02-parcels-domain-analysis.md) §1) — a latent performance/DoS risk. In the new architecture, treat CSV/report export as an **async background job**: enqueue the export, generate the file server-side (streamed or written to storage), and notify/link the admin user when ready, rather than blocking a Route Handler on an unbounded query. This redesign is **mandatory scope**, not optional — see Phase 4 in [06-phased-rollout-plan.md](06-phased-rollout-plan.md).

## 6. What is explicitly out of scope for this document

- Final choice of ORM/query builder (e.g. Prisma, Drizzle, or raw `pg`) is an implementation detail to be decided during Phase 1 execution, not fixed here.
- Final choice of hosting/deployment platform is not fixed here; the architecture assumes a Node-compatible host with support for scheduled jobs (Vercel or equivalent), but is not locked to one.
