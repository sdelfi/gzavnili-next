# 06 — Phased Rollout Plan

## Overall approach

**Strangler-fig, database-first, domain-by-domain migration — not big-bang.** Rationale:

- Live payment gateways (`extensions/components/orders/{PayPal,AuthorizeNet,CyberSource,PayFlowPro,Sage,InternetSecure}.cfc` plus custom GZPay) mean a full simultaneous cutover carries unacceptable transaction-loss risk.
- The 114k-LOC main app and 40k-LOC bema app are too large to rewrite atomically; `Account.cfc` (1600 lines) and `Checkout.cfc` (1284 lines) alone mix dozens of authenticated features that would need parallel re-verification if cut over all at once.
- Four duplicate mobile API surfaces mean live client traffic patterns aren't fully knowable from code alone — cutting all of them over simultaneously is high risk (see Phase 0).

**Mechanism**: a reverse-proxy/router at the edge (Next.js middleware, or an nginx/Cloudflare layer in front of both stacks) routes by path prefix. Public static pages migrate first (zero state, safest), then read-only authenticated views, then write-paths (checkout, payments) last, then bema admin (highest-criticality writes, migrated only once the schema is proven under read traffic).

Postgres becomes the system of record early; MSSQL is kept as a bounded-window read-only fallback per domain during transition, not a long-lived bidirectional sync (see [05-data-migration-strategy.md](05-data-migration-strategy.md) §4).

**Important sequencing constraint**: customer-facing parcel tracking and bema-admin-facing parcel status/list must cut over in the **same deployment window**, not staggered across different weeks — otherwise two systems could disagree on a given parcel's status simultaneously (legacy CF CASE vs. new Postgres trigger), which is confusing for both customers and admin staff and a real support-ticket risk.

---

## Phase 0 — Audit & Hygiene (no migration yet)

**Scope:**
- Disambiguate `http/API` vs. `ApiNew` vs. `ApiNew2` vs. `api2`: check web server access logs / APM / mobile app version telemetry (not code alone) to determine which is actually live. Document the decision. Mark dead variants for deletion, not migration.
- Rotate all plaintext secrets in `http/Application.cfc` (SendGrid, payment gateway/GZPay creds, API basic-auth) — independent of and before migration work begins, since this is a live production exposure today. Check whether any of these creds are embedded in a mobile app binary (would require an app-side update, not just backend rotation).
- Confirm the coupons-module scope boundary (files/tables) so later phases don't accidentally touch or depend on excluded code (see [01-current-state-audit.md](01-current-state-audit.md) §9).
- Resolve the open business-logic question: which status priority order is correct — the list-query order or the `read()` order (see [02-parcels-domain-analysis.md](02-parcels-domain-analysis.md) §2.3)? Document the answer.
- Follow-up code search: locate exact call sites of the UPS/FedEx/USPS shipping integrations (`com/portline/shipping/`) to determine whether they're synchronous in the checkout path or async/cron-driven — needed to scope Phase 3 accurately.

**Exit criteria:** live API surface identified and documented; secrets rotated; coupons boundary confirmed; status-order decision documented; shipping-integration call sites documented.

---

## Phase 1 — Foundation: Postgres schema + parcels domain core

**Scope:**
- Design and stand up the new Postgres schema per [04-postgres-schema-design.md](04-postgres-schema-design.md): `parcels` (extended), `users`, `addressbook`, `receivers`, `invoices`/`invoices_items`, `payments`, `parceloffice`/`delivery_offices`, `config` (typed), `user_balances`, `parcel_status_history`.
- Build the status-computation trigger/function (`fn_recompute_parcel_status`) and the denormalization triggers (`is_paid`, `is_invoiced`, `invoice_amount`, `office_name`, `user_balances`).
- Build the batched ETL/backfill scripts per [05-data-migration-strategy.md](05-data-migration-strategy.md); run against a copy of production data; reconcile against legacy CASE output (status-distribution + financial-aggregate checks).

**Not yet user-facing** — this phase is entirely backend/data, verified via scripts and internal tooling only.

**Exit criteria:** reconciliation checks pass on a full copy of production data; schema and triggers reviewed and considered stable enough to build against.

**Status (implemented, this pass):** schema + triggers stood up via Prisma (`prisma/schema.prisma`, `prisma/migrations/`) — see [docs/decisions/0010-prisma-migrations.md](../decisions/0010-prisma-migrations.md) for the ORM/engine choice and the migration-safety policy. All triggers (`fn_recompute_parcel_status`, status history, office-name/invoice/user-balance denormalization) smoke-tested manually against the local docker-compose Postgres. **Not done yet**: the ETL/backfill scripts from [05-data-migration-strategy.md](05-data-migration-strategy.md) (no MSSQL source is reachable from this environment), and the reconciliation checks — those remain this phase's actual exit criteria. The status-order open question (see [07-risks-and-open-questions.md](07-risks-and-open-questions.md) #1) is implemented provisionally, not resolved.

---

## Phase 2 — Public static site (SSG)

**Scope:**
- Migrate home/services/cargo/courier/pricing/FAQ/legal/news pages to Next.js SSG/ISR.
- Content source decision: either hardcode in-repo (if truly static) or back with a lightweight content table — bema's `content/` module implies editable content today; decide whether content editing moves to the Phase 4 admin rebuild or stays bridged to the legacy bema content module temporarily via API.
- Public unauthenticated tracking page: becomes the **first consumer of the new Postgres parcels schema/status column** (read-only), proving Phase 1's design under real public traffic before any authenticated or admin surface depends on it.
- Reverse-proxy routes these paths to the new deployment; everything else remains on the legacy stack.

**Exit criteria:** public pages served from Next.js in production; tracking page reads live from Postgres and matches legacy output for a verification period.

---

## Phase 3 — Authorized customer zone (CSR)

**Scope:**
- Auth (login/register/password recovery) on the new stack, new session/JWT model, backed by Postgres `users`.
- "My parcels"/tracking history, statements, invoices (read paths) — direct beneficiaries of Phase 1's denormalization.
- Account management, receivers CRUD.
- Checkout/payments (write paths) — **last** within this phase. Requires porting each gateway wrapper (`extensions/components/orders/*.cfc`: PayPal, AuthorizeNet, CyberSource, PayFlowPro, Sage, InternetSecure, GZPay/MerchantGateway) to Node equivalents or official SDKs, tested against sandbox environments before going live. Cut over **one gateway at a time**, not all simultaneously, with a rollback toggle keeping the legacy checkout path available per-gateway until each is proven in production.

**Exit criteria:** all customer-zone reads and writes served from the new stack; each payment gateway verified in production with a defined rollback window closed.

---

## Phase 4 — bema admin (CSR)

**Scope:**
- Parcels module first (list/detail) — reuses everything validated in Phases 1-3; this is where the `getParcels()` rewrite (keyset pagination, flattened query, single status source) becomes user-facing for the first time, to internal staff only (lower blast radius than customer-facing).
- Then products, orders, users, statements, reports, messages, config modules.
- **Coupons module explicitly excluded** — left on the legacy stack or deprecated per a separate client decision, outside this plan's scope.
- CSV export rebuilt as an async job per [03-target-architecture.md](03-target-architecture.md) §5 — mandatory, not optional.

**Exit criteria:** all in-scope bema modules live on the new stack; admin staff sign-off on the parcels list/detail behavior matching (or intentionally improving on, per the resolved status-order decision) legacy behavior.

---

## Phase 5 — Mobile API consolidation

**Scope:** only the surviving API variant (per Phase 0's audit) gets ported to Next.js Route Handlers; the rest are deleted. Depends on Phases 1 and 3 (reuses the same parcels/auth backend). Whether to migrate vs. rewrite this surface is a decision still pending client confirmation (see [07-risks-and-open-questions.md](07-risks-and-open-questions.md)).

---

## Phase 6 — Cron/background job migration

**Scope:** `onhold.cfm`, `changeParcelStatus.cfm`, SMS jobs, etc. → scheduled jobs/queue workers per [03-target-architecture.md](03-target-architecture.md) §4, largely subsumed by Phase 1's trigger design (the Received→Shipped transition becomes a scheduled Postgres function call rather than app-level CF logic re-deriving status).

---

## Phase 7 — Full cutover & legacy decommission

**Scope:** final MSSQL read-only freeze, DNS/proxy fully to the new stack, decommission CF/Lucee infrastructure after a defined observation window.

---

## Dependency summary

```
Phase 0 (audit) ──> Phase 1 (schema/ETL) ──> Phase 2 (public+tracking) ──> Phase 3 (customer zone)
                                                                       └─> Phase 4 (bema admin)
                                              Phase 3 & 4 ──> Phase 5 (mobile API)
                                              Phase 1 ──> Phase 6 (cron)
                          Phases 2-6 complete ──> Phase 7 (cutover/decommission)
```
