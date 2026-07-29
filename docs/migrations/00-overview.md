# Migration Plan: ColdFusion/MSSQL → Next.js/Postgres

## Purpose of this document set

This `docs/` folder is a scoping and architecture package prepared for a planned migration of gzavnili.com from its current legacy stack (Adobe ColdFusion/Lucee + MSSQL) to a modern stack (Next.js + Postgres). It is written to be picked up by any AI coding agent (Codex, Gemini, Claude, etc.) or a human engineer, without prior context on this codebase.

**Status: planning/estimation only.** No migration work, schema changes, or code changes have been made yet. This is the basis for a client work-estimate and phased execution plan.

## Goals

- Migrate **all** sections of the public site and the `bema` admin panel, **except the coupons module**, which the client has explicitly excluded from scope.
- Move to **Next.js** for the frontend/application layer and **Postgres** for the database.
- Public marketing/static pages (home, services, pricing, FAQ, legal/customs, news) → **statically generated** (SSG/ISR), since their content is not dynamic.
- The authorized customer zone ("personal cabinet": login, parcel tracking, order/statement history, account management) → **client-side rendered (CSR)**, no SSR required.
- The `bema` admin panel → **CSR**, no SSR required.
- Cron jobs are still required, but should be rebuilt on a modern scheduling/queue mechanism (Next.js/backend-framework native, e.g. Vercel Cron or a worker queue) instead of CFML cron scripts.
- External/mobile API surfaces (`http/API`, `ApiNew`, `ApiNew2`, `api2`) go through an **audit phase first**; whether to migrate or rewrite them is a decision deferred until the client confirms which surface is actually live.
- **This is not a lift-and-shift.** The client's core pain point — the `bema/parcels` admin section — has severe query complexity and performance problems rooted in how "parcel status" is computed. The migration is the opportunity to redesign the database schema and business logic for this domain, not just port it as-is.

## Non-goals / explicit exclusions

- **Coupons module** — excluded from migration scope entirely, per explicit client instruction (confirmed twice). Do not migrate, do not redesign its schema. Phase 0 must confirm the exact file/table boundary of this module so later phases don't accidentally assume its presence or depend on shared tables.

## Document map

| File | Contents |
|---|---|
| [01-current-state-audit.md](01-current-state-audit.md) | Inventory of the current CFML/MSSQL system: stack, directory structure, duplicate API surfaces, secrets requiring rotation, scale, auth model, cross-cutting config table, coupons boundary. |
| [02-parcels-domain-analysis.md](02-parcels-domain-analysis.md) | Deep business-logic analysis of the `bema/parcels` module: the status computation waterfall, all duplicate/drifted copies of that logic, related tables/columns, and the core performance problems. This is the central technical problem the migration must solve. |
| [03-target-architecture.md](03-target-architecture.md) | Proposed Next.js application architecture: route groups for public/SSG vs. authorized/CSR vs. admin/CSR, API layer, auth strategy, cron/job replacement, export/reporting redesign. |
| [04-postgres-schema-design.md](04-postgres-schema-design.md) | The core schema redesign for the parcels domain: replacing the virtual status CASE with a maintained column, eliminating per-row correlated subqueries, indexing strategy, pagination strategy. |
| [05-data-migration-strategy.md](05-data-migration-strategy.md) | MSSQL → Postgres data migration approach: tooling, type mapping, cutover model, verification/reconciliation. |
| [06-phased-rollout-plan.md](06-phased-rollout-plan.md) | The actionable phase-by-phase execution plan (Phase 0 through Phase 7), with scope, dependencies, and entry/exit criteria per phase. |
| [07-risks-and-open-questions.md](07-risks-and-open-questions.md) | Risk register and explicit open questions requiring client/stakeholder decisions before or during execution. |

## How to use this doc set

- Start here, then read `01` and `02` to understand the current system before proposing any implementation.
- `03`–`05` are the target-state design; treat them as the recommended approach, not yet a final locked spec — the open questions in `07` should be resolved before implementation begins on the affected areas.
- `06` is the actionable checklist — an agent picking up execution work should work phase by phase from that file, cross-referencing `01`/`02`/`04` for the "why" behind each schema/architecture decision.
- All file paths, table names, and column names cited across these documents were verified directly against the codebase at `/Users/delfi/projects/ecom/gzavnili.com` (this repo) as of 2026-07-29. If the codebase has changed since, re-verify before relying on specifics.
