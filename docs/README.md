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
