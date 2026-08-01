# docs

## Live reference

**Production site (source of truth for current behavior/design):** https://usa.gzavnili.com/

Always cross-check ported pages against the live site directly — the legacy repo's
`http/views/*.html` files are frequently stale/dead (see
[`../PROGRESS.md`](../PROGRESS.md) for a concrete example on the homepage). The actual
content for most public pages is server-rendered from a per-URL JSON cache in the legacy
app (`http/include/pages/<sha1-hex-upper(url)>.json`, `content` field), not from those
static view files — treat the view files as suspect until checked against either the cache
file or the live site.

## Structure

- **`migrations/`** — the pre-implementation scoping/architecture package (moved from the
  parent legacy repo's `../docs/`, which is gitignored there and un-tracked). Written before
  Phase 2 implementation started; treat as the plan, not a live status report — see
  `../PROGRESS.md` for what's actually been done and what it revealed.
- **`decisions/`** — short, dated records of decisions made *during* implementation that
  aren't already covered by `migrations/` (or that refine it). One file per decision.
- **[`findings.md`](findings.md)** — a running log of legacy quirks/bugs discovered while
  porting (not decisions about this project — what the *legacy* source actually does, and
  what happened to it: ported as-is, not reachable, or open). See AGENTS.md's "Legacy
  fidelity: bugs are ported, not fixed" rule.

## Decisions log

| # | Decision | File |
|---|---|---|
| 0001 | No monorepo / no separate backend service | [decisions/0001-no-monorepo.md](decisions/0001-no-monorepo.md) |
| 0002 | react-select as the select2 replacement | [decisions/0002-select-library.md](decisions/0002-select-library.md) |
| 0003 | Mobile API stays in this app, no monorepo | [decisions/0003-mobile-api.md](decisions/0003-mobile-api.md) |
| 0004 | Scheduled jobs: OS cron + BullMQ (plain Redis, no modules), self-hosted only | [decisions/0004-scheduled-jobs.md](decisions/0004-scheduled-jobs.md) |
| 0005 | Header personalization via plain dynamic SSR (Cache Components/PPR tried, reverted) | [decisions/0005-cache-components.md](decisions/0005-cache-components.md) |
| 0006 | No vendored legacy JS bundles; own/modern replacements only | [decisions/0006-no-vendored-legacy-js.md](decisions/0006-no-vendored-legacy-js.md) |
| 0007 | Move large CSS `background: url()` images to `next/image` | [decisions/0007-next-image-for-css-backgrounds.md](decisions/0007-next-image-for-css-backgrounds.md) |
| 0008 | i18n via next-intl, locale ids `en`/`ge` matching the legacy site | [decisions/0008-i18n-next-intl.md](decisions/0008-i18n-next-intl.md) |
| 0009 | Catch CSS Modules typos via generated TS types, not an ESLint plugin | [decisions/0009-css-modules-type-checking.md](decisions/0009-css-modules-type-checking.md) |
| 0010 | Prisma 7 for schema/migrations; Postgres reconfirmed over MySQL; migration safety policy | [decisions/0010-prisma-migrations.md](decisions/0010-prisma-migrations.md) |
| 0011 | bema admin panel: auth + user management (first slice) | [decisions/0011-bema-admin.md](decisions/0011-bema-admin.md) |
| 0012 | Customer-facing auth realm (login/register/forgot/reset) | [decisions/0012-customer-auth.md](decisions/0012-customer-auth.md) |
| 0013 | Site Pages CMS (bema "Site Pages") | [decisions/0013-site-pages-cms.md](decisions/0013-site-pages-cms.md) |
| 0014 | Site-wide announcement popup (bema "Site Settings" → "Popup") | [decisions/0014-site-popup.md](decisions/0014-site-popup.md) |
| 0015 | bema Parcels (list + edit): what was ported, and what was deliberately not | [decisions/0015-bema-parcels-list.md](decisions/0015-bema-parcels-list.md) |
| 0016 | Parcels list performance: measured at 1M rows, fixes, and the repeatable benchmark script | [decisions/0016-parcels-performance.md](decisions/0016-parcels-performance.md) |
| 0017 | bema Parcels: batch "Add Parcel" (`parcels-add.cfm`) — the group-fee calculation and what wasn't ported | [decisions/0017-bema-add-parcel.md](decisions/0017-bema-add-parcel.md) |
| 0018 | Parcel edit history and reports | [decisions/0018-parcel-edit-history.md](decisions/0018-parcel-edit-history.md) |
| 0019 | Separate public and bema UI primitives | [decisions/0019-admin-ui-boundary.md](decisions/0019-admin-ui-boundary.md) |
