# 0011 — bema admin panel: auth + user management (first slice)

## Scope of this pass

Phase 4 in [docs/migrations/06-phased-rollout-plan.md](../migrations/06-phased-rollout-plan.md) is "bema admin (CSR)" — this implements the first slice of it ahead of the plan's own sequencing (parcels normally comes first there), per explicit client request: authentication and the user-management screen (the legacy `edit_users`-equivalent), plus the shared UI primitives every other bema module will reuse. Design/markup fidelity to the legacy Bootstrap-based bema UI was explicitly **not** required by the client — only that the functionality is preserved.

## What the legacy screens actually do (research findings)

- **Login**: `http/bema/login.cfm` + `MSSQLUserDAO.validateLogin()`. Username-or-email + password. Password hashing is `SHA-1(password + salt)` (`User.cfc.hashPassword`) — the *same* scheme as the customer-facing login, no bema-specific KDF. 15 failed attempts (counted since the account's last successful login) locks the account for 15 minutes; every attempt is logged to `securitylog`. Bema inherits the main app's 1-day session timeout — no shorter bema-specific one exists.
- **Users table**: there is **no separate bema-admin-accounts table**. Bema admins and customer accounts are the exact same `users` table and `User` CFC, distinguished by `TypeId` (1=BEMA/2=Customer) and a `users_groups`/`groups` junction that dual-purposes as "admin role" for bema accounts and "discount tier" for customer accounts.
- **`edit_users` itself**: the real screens are `http/bema/users/users.cfm` (list) and `http/bema/users/user_edit.cfm` (create/edit), parameterized by `url.tid` (1 or 2) — **one screen manages both BEMA admins and customers**, not two separate features. List screen requires role `WEBSITE_ADMINISTRATOR`/`ADMINISTRATOR`; the edit screen has a *broader* allow-list that also includes `AGENT_ADMINISTRATOR` (an Agent can open/edit one record but not browse the full list). There is no hard delete — the DAO's `delete()` is a no-op stub; deactivation is the `Active` checkbox instead. No bulk actions.

## Deliberate simplifications vs. the legacy model

- **`AccountType` enum** (`Customer`/`BemaUser`) replaces `TypeId`. **`AdminRole` enum** (`BemaStandard`/`BemaAdministrator`/`BemaAgent`) replaces the `users_groups`/`groups` junction *for the admin-role case only* — every legacy account only ever had one effectively-active admin role despite the junction-table modeling (and the junction's `FrontEnd` bit distinguishing admin-role rows from discount-tier rows was already inconsistently honored in the legacy code), so collapsing to a single enum column loses no real behavior.
- **Customer discount/wholesale tiers** (the `groups` table's other purpose) are explicitly **out of scope** for this pass — `customer_pricing_rules` already exists in the legacy DB as a separate, more modern mechanism for that (see [docs/migrations/02-parcels-domain-analysis.md](../migrations/02-parcels-domain-analysis.md) §4's "unrelated to parcels" note).
- **Billing/shipping address editing** (two full `addressbook` sub-forms in the legacy `user_edit.cfm`) is deferred — not implemented in this pass. See PROGRESS.md.
- **Password hashing**: new accounts hash with **argon2id via `Bun.password`** (no external KDF dependency — Bun has this built in), not SHA-1. `User.passwordAlgo` distinguishes this from a future `legacy-sha1` value an MSSQL import would set — see [docs/migrations/07-risks-and-open-questions.md](../migrations/07-risks-and-open-questions.md)'s "Password hash migration" risk. No legacy-hash verification path exists yet since no legacy accounts have been imported into this schema.
- **Role checks are still flat allow-lists per route**, matching the legacy `require.cfm groups="A,B,C"` pattern exactly (`src/lib/auth/session.ts`'s `requireBemaSession`) — not a granular per-permission RBAC system, since the legacy system never had one either.

## Auth architecture

Two independent auth realms per [docs/migrations/03-target-architecture.md](../migrations/03-target-architecture.md) §3 — this is the bema realm; no customer-facing auth exists yet, and this implementation must never share its secret/cookie namespace with one when it's built.

- **JWT access token (15 min) + refresh token (7 days)**, both httpOnly/secure(prod)/sameSite=lax cookies named `bema_access_token`/`bema_refresh_token` (`src/lib/auth/cookies.ts`), signed with `jose` (HS256) using `BEMA_AUTH_SECRET` (`src/lib/auth/jwt.ts`) — a secret dedicated to this realm, never reused elsewhere.
- **CSR-only, no middleware-based SSR gating** (per the target-architecture doc): `src/app/bema/(protected)/layout.tsx` is a client component that redirects to `/bema/login` if `/api/bema/auth/me` comes back unauthenticated — this only avoids flashing protected UI, since **the real authorization is always enforced server-side** in every `/api/bema/*` route handler via `requireBemaSession` regardless of what the client-side guard does.
- `/api/bema/auth/{login,logout,me,refresh}` — login runs the lockout/attempt-logging logic (`src/lib/auth/login.ts`, mirroring the legacy thresholds), refresh rotates both tokens on every call (sliding session).
- **Bootstrap problem**: the panel is itself login-gated, so there's no in-UI way to create the very first admin account. `scripts/seed-admin.ts` (`bun run db:seed`) solves this: it's a no-op if any `BemaUser` account already exists (safe to run any number of times, can't be used to reset an existing account's password by accident), and only creates one from `BEMA_SEED_USERNAME`/`BEMA_SEED_EMAIL`/`BEMA_SEED_PASSWORD` env vars when zero exist.

## Route structure

`/bema/*` is a fully independent route tree from the public marketing site's `[locale]/*` — its own root layout (`src/app/bema/layout.tsx`, own `<html>`/`<body>`, no next-intl/Header/Footer/legacy CSS). Next.js supports multiple independent root layouts as long as neither is nested inside the other, which holds here since `bema/` and `[locale]/` are disjoint sibling folders under `src/app/` — this is the documented pattern, not a workaround. `(protected)` is a route group (no URL segment) holding everything behind the auth guard; `/bema/login` sits outside it.

`routes.bema.*` in `src/lib/routes.ts` is a separate nested object from the existing customer-facing `routes.login()`/`routes.logout()` (which are the legacy `/authenticate/*` paths) — different realm, different names, no collision.

## Shared UI primitives

New, self-contained (CSS Modules, no dependency on `public/css/style.css` — bema doesn't load that stylesheet) additions to `src/components/ui/`, per the client's explicit ask for reusable table/button/etc. components ahead of building out the rest of bema:

- **`Button`** (primary/secondary/danger variants).
- **`Table`** — generic sortable/zebra-striped data table (presentation-only; sort/pagination state is owned by the page, URL-driven, so lists stay bookmarkable — matching the legacy pattern of keeping all list state in the query string).
- **`Pagination`** — windowed page-number strip, mirroring the legacy `pagination_admin.cfm` custom tag's behavior.
- **`Alert`**/`ErrorList` — success/error banners, replacing the legacy `Udf.displayErrors()` flash-message pattern (there it was a one-shot server-rendered banner via the CF session; here it's just a plain presentational component, since bema is CSR and owns its own request/response cycle per API call).

`src/components/admin/` holds bema-specific composition (not generic-reusable-enough for `ui/`): `AuthProvider`/`useBemaAuth`, and `users/UserListPage` + `users/UserForm` — the shared list/form pair parameterized by `accountType`, mirroring the legacy single-screen-for-both-tid-values design described above.

## Migration workflow note

The `add_bema_auth` migration (adding `AccountType`/`AdminRole`/the new `User` columns/`SecurityLog`) is where the [0010-prisma-migrations.md](0010-prisma-migrations.md) policy got its first real correction: hand-added trigram indexes from the initial migration showed up as `DROP INDEX` in the generated diff (indexes *are* something Prisma's introspection manages, unlike trigger functions) — see that doc's updated policy section for the fix (trim the generated migration by hand before applying, don't regenerate the indexes from scratch) and the non-interactive `prisma migrate diff --from-migrations` workaround needed to generate a migration at all without a real TTY.
