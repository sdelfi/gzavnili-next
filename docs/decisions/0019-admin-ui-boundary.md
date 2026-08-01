# 0019 — Separate public and bema UI primitives

## Decision

The public site and the bema panel have separate visual systems and must not share styled
form or data-display primitives by accident:

- `src/components/ui/` contains public-site primitives.
- `src/components/ui/admin/` contains bema primitives.
- `src/components/admin/` contains feature composition only. It must use the admin
  primitives for buttons, inputs, selects, textareas, checkboxes, tables, pagination,
  dialogs, tabs, headings, and labelled fields instead of declaring those controls locally.

Reuse inside each visual system is the default. A repeated admin pattern is promoted to
`ui/admin/` when it appears for the second time; a feature stylesheet may size or position a
primitive, but it must not recreate its base chrome.

## Why the boundary is necessary

The earlier shared directory mixed public controls styled by legacy public CSS with bema
controls styled by CSS Modules. In particular, bema reused the public `Input` and `Select`
and then repaired their height and border globally in `bema.css`. This made the same import
behave differently depending on which root layout loaded it and allowed feature pages to
grow local button and table implementations.

The bema primitives now own their complete CSS. `bema.css` is limited to the panel's reset
and root typography/background; it no longer reaches into individual controls.

## Table contract

`ui/admin/Table` provides two levels of reuse:

- `Table<T>` for normal data lists and reports, including sorting, empty state, density, and
  footer rows.
- `TableSurface` for structurally exceptional legacy tables whose multi-row headers,
  grouped rows, or nested cells cannot be represented by flat column definitions. It still
  centralizes scrolling, typography, cell spacing, borders, and footer styling.

Both layers expose `density="normal" | "compact" | "condensed"`. `condensed` is the shared
admin-table mode for wide legacy datasets: 11px type with 2×3px cell padding. Feature tables
may define semantic column widths through a `colgroup`, but must not reimplement density or
base table chrome locally.

This keeps specialized parcel markup possible without copying the table's visual system.

## Audit result

All controls rendered under `src/components/admin/` and `src/app/bema/` now come from
`src/components/ui/admin/`. The reports screens, draft-parcel table, shipment cards, and
nested parcel tables use the shared table layer; Parcel Reports also uses the shared `Tabs`
component. A repository search for native `button`, `input`, `select`, `textarea`, and
`table` elements in the admin feature tree now finds only explanatory comments.
