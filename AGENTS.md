<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Commit message rules

Do not add a `Co-Authored-By:` trailer (or any AI-attribution trailer) to commit
messages in this repo.

# Shared components

Reusable UI primitives (inputs, selects, buttons, and the like) belong in
`src/components/ui/`, not hand-rolled inline in whichever page/component
needs them first. Before writing a new `<input>`/`<select>`/etc., check
`src/components/ui/` for one that already fits, and extend it rather than
duplicating markup. If a pattern shows up in a second place, promote it to
`src/components/ui/` as part of that change.

# One component, one folder

Every component gets its own folder: `ComponentName/ComponentName.tsx` +
`ComponentName.module.css` (if it has one) + `index.ts` (a one-line barrel:
`export { ComponentName } from './ComponentName';`, plus any other named
exports/types the component file has). No exceptions, no "just this once flat
file next to three others in a shared folder" — that's exactly the pattern
that becomes an unnavigable pile of same-named files
(`UserForm.tsx`/`UserForm.module.css`/`UserForm.module.css.d.ts` sitting flat
alongside `AddressFields.tsx`/`PricingRulesSection.tsx`/... in one folder) that
this rule exists to prevent. This applies everywhere — `src/components/`,
`src/components/ui/`, `src/components/admin/`, and any nested feature folder
like `src/components/admin/users/` — not just top-level page sections.
`index.ts`-based re-exports mean callers still import from the logical path
(`@/components/ui/Button`, `@/components/admin/users/UserForm`) with no
changes needed elsewhere.

The one deliberate exception: `src/components/ui/Input.tsx`/`Select.tsx` stay
flat with a plain (non-Module) companion `.css` file, because they
intentionally style via global classnames rather than CSS Modules (see
`docs/decisions/0002-select-library.md`) — that's a different, already-decided
pattern, not a license to leave other components flat too.

When a component's folder has types worth naming (props types other components
import, enums, anything beyond the component's own inline prop destructuring),
put them in that folder's `types.ts`, not inline in the `.tsx` file — e.g.
`src/components/ui/Icon/types.ts`'s `IconName`. Re-export from `index.ts`
alongside the component itself.

# Global CSS cleanup

`public/css/style.css` (and its siblings) is legacy-ported global CSS, not a permanent home
for new styling. Whenever you touch a page/component that relies on rules in there: if a
rule is specific to that one component, move it into that component's own `.module.css`
(CSS Modules, per "One component, one folder" above) instead of leaving it global; if a rule
is genuinely shared across many components (resets, typography, `.container`, `.btn`, form
control base styles), move it to `src/app/globals.css` instead of leaving it in the legacy
file. The end goal is to empty `style.css` out entirely, component by component, as each
page gets touched — not a one-shot rewrite, but also not something to skip just because a
page "already works" with the old global rule still in place.

**Exception: `public/css/static.css`.** This one backs the Site Pages CMS
(`docs/decisions/0013-site-pages-cms.md`) — arbitrary admin-authored HTML that can reference
any legacy classname across dozens of page-specific designs, not a fixed set this project
controls. It is a deliberately uncurated, wholesale copy of prod's stylesheet, not something
to migrate piecemeal into components like `style.css`. Re-sync it by re-fetching
`usa.gzavnili.com/css/style.css` outright when it's next known to be stale; don't hand-edit
or selectively trim it.

# Public pages are server-rendered

Every page under `src/app/[locale]/` (the public, customer-facing site — marketing pages,
login/register/forgot/reset, anything SEO matters for) must render its real content
server-side, not as a client-only fill-in after hydration. A visitor (and a crawler) should
see the actual content in the initial HTML, not a blank/placeholder that gets replaced by a
`useEffect` a moment later. This is why `Greeting` (`src/components/auth/Greeting/`) computes
its time-of-day bucket from the server's own clock rather than the visitor's browser clock —
reading `Date` client-side after mount would be more accurate per-visitor, but violates this
rule (SEO + no flash of missing content wins over per-visitor precision here). Client
components are fine for genuinely interactive behavior (dropdowns, modals, form submission)
that has no server-renderable initial state to begin with — the bar is "does real content
depend on this," not "is this a client component at all." The bema admin panel
(`src/app/bema/`) is the deliberate exception — it's CSR-only by design (see
docs/migrations/03-target-architecture.md §3), not a public/SEO surface.

# Routing

Every internal `href`/`action` goes through `src/lib/routes.ts`'s `routes`
helper (`routes.home()`, `routes.login()`, `routes.page("slug")` for a
static marketing page, etc.) instead of a literal path string. Add a new
named helper there when a route doesn't have one yet.

# API calls go through a service layer

Components/pages never call `fetch()` directly against `/api/bema/*` (or any
other internal API) — that belongs in a typed function under
`src/lib/api/`, which the component imports and calls instead. Layout:
`src/lib/api/http.ts` holds the shared low-level plumbing (`apiGet`/
`apiPost`/`apiPatch`/`apiDelete`, the `ApiError` class carrying `status`/
`body`, and `extractErrorMessages()` for the common
zod-`{formErrors,fieldErrors}` response shape); one file per domain sits
under `src/lib/api/bema/` (`auth.ts`, `users.ts`, `pricingRules.ts`,
`pages.ts`, ...) and exports the actual typed request functions
(`login()`, `listUsers()`, `createPage()`, ...). A component's job is to
call `listUsers(params)` and handle the typed result/`ApiError`, not to
know the URL, method, `credentials: 'same-origin'`, or JSON
stringify/parse boilerplate — that's exactly the duplication this rule
exists to kill (ten components had it copy-pasted before this was
written). Add a new function to the relevant domain file (or a new
domain file) when a route doesn't have one yet, the same way
`routes.ts` works for hrefs.

# Database schema/migrations

Never hand-write SQL that a proper tool should generate. Schema changes go through Prisma
(`prisma/schema.prisma` → `bun run db:migrate` locally, which wraps `prisma migrate dev` and
generates the migration file for you) — don't hand-author `CREATE TABLE`/`ALTER TABLE`/index
DDL that Prisma's schema diffing already produces correctly.

The only DDL that's ever hand-written is what Prisma's schema language genuinely cannot
express: trigger functions and `CHECK` constraints beyond simple ones. That goes in a
clearly-marked block appended to the end of the relevant generated migration file (see
`prisma/migrations/*/migration.sql`'s `-- ===` banner comment for the existing example) —
never scattered into ad hoc `.sql` scripts run by hand outside the migration history.

**Indexes are different from triggers**: Prisma's introspection does model indexes, so a
hand-added index not declared in `schema.prisma` (e.g. the `pg_trgm` GIN indexes) shows up
as drift and gets a `DROP INDEX` proposed for it on every future migration you generate.
When generating a new migration, always read the diff before applying it and manually
remove any `DROP INDEX` line targeting one of those — see
`docs/decisions/0010-prisma-migrations.md` for the full explanation and for the
`prisma migrate diff --from-migrations` workaround needed to generate a migration at all in
a non-interactive (agent) shell, since `prisma migrate dev` refuses to run in one.

Migration safety (see `docs/decisions/0010-prisma-migrations.md` for the full policy):
`bun run db:migrate` is local-only (guarded by `scripts/guard-local-db.mjs`); production only
ever runs `bun run db:migrate:deploy` (`prisma migrate deploy`) via `deploy.sh`, one command,
which never resets or drops data. Never run `prisma migrate reset`/`prisma db push` against
production — there is deliberately no script for either in `package.json`.

# Progress log

After any implementation work in this repo (features, fixes, refactors — not
one-off investigation), update `PROGRESS.md`: check off the step(s) completed,
and add new unchecked items for anything the work revealed as still
outstanding. Keep entries terse and reference the commit hash. Do this as part
of the same change, not as a separate follow-up.
