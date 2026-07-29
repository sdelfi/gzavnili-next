# 0009 — Catch CSS Modules typos via generated TypeScript types, not an ESLint plugin

**Status:** implemented.

## Problem

The kebab-case (global CSS) → camelCase (CSS Modules) migration this project is doing
component-by-component (see AGENTS.md's "shared components" rule and the `HomeHero`/
`HeaderClient`/etc. precedent) has an easy failure mode: a class gets renamed on one side
(the `.module.css` file) but not the other (the `.tsx` still references the old name, or a
typo'd new one) — the reference silently resolves to `undefined`, so React just drops the
class with no error, warning, or visual difference you'd necessarily notice.

## What was tried and rejected

`eslint-plugin-css-modules` (`no-unused-class`/`no-undef-class`) — the obvious ESLint-based
tool for this. Installed and configured it, then verified it against a deliberately broken
reference (`s.advItem` → `s.advItemTypo`) and it reported nothing. The package is marked **"NOT
MAINTAINED"** by its own author on GitHub and doesn't reliably parse this project's
TypeScript/TSX. Shipping a linter that silently doesn't work is worse than shipping none — it
looks like coverage that isn't there. Removed.

## Decision

Use [`typed-css-modules`](https://github.com/skovy/typed-css-modules) (`tcm`) to generate a
`ComponentName.module.css.d.ts` next to each `.module.css`, giving every class a named,
typed export. A reference to a class that doesn't exist is then a real `tsc`/`next build` type
error — using infrastructure already fully trusted in this project's pipeline, not a
third-party lint rule of uncertain quality.

- `bun run css-types` — runs `tcm src -p '**/*.module.css' --camelCase` once.
- Wired into `predev` and `prebuild` (`package.json`), so the types are always fresh before
  `next dev`/`next build` run — confirmed `bun run dev` regenerates all seven `.d.ts` files
  before starting the dev server.
- Generated files are gitignored (`*.module.css.d.ts` in `.gitignore` and excluded from ESLint)
  — derived artifacts, not authored, same treatment as `.next/`.

Verified end-to-end: a deliberately broken reference (`s.foo` where `foo` isn't a real class)
fails `next build` with a proper TypeScript error naming the file/line and listing the actual
available class names. This also caught a **real pre-existing bug** while testing it:
`HomeHero.tsx` referenced `s.parallaxLayer`, a class that was never defined in
`HomeHero.module.css` (removed — `.carObject`/`.boxesObject` already carried the actual
styling, so `parallaxLayer` was dead weight, not a missing rule).

## Known gap

This only catches one direction: a `.tsx` referencing a class that doesn't exist. It does
**not** catch the reverse — a `.module.css` class that's declared but never referenced from
its component (genuinely dead CSS, lower risk than a silently-broken reference, since it just
means unused bytes rather than missing styling). No currently-maintained tool does this well
for a TypeScript/CSS-Modules stack (checked in this session) — falls to manual review during
each component's migration for now.
