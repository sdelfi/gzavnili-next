# 0002 — react-select as the select2 replacement

**Status:** implemented as `src/components/ui/Select.tsx`, used everywhere a `<select>`
appears (not only pages that had select2 applied — see "Revised scope" below).

## Decision

Use [react-select](https://react-select.com/) wherever the legacy site used select2
(`http/js/select2/`), instead of porting select2/jQuery itself. Wrapped in a shared
`src/components/ui/Select.tsx` (per AGENTS.md's shared-components rule) rather than calling
react-select directly from each form.

## Why

There's no official React port of select2. select2 is used across the legacy account/
checkout/payment pages (`main.js`, `main2.js`) for searchable dropdowns (e.g. office picker
in `main.js` around the `deliveryOffice-col` select). react-select was picked over a
native-`<select>` + custom CSS approach because it's the most widely used, actively maintained
option and supports full restyling via `classNamePrefix`/`unstyled` without hand-building
search/keyboard-nav behavior.

`src/components/ui/Select.css` recreates the visual rules from
`public/css/style.css`'s `.select2-container--default...` block (border/height/colors, and the
same `icons.png` sprite coordinates for the dropdown arrow) against react-select's own class
names — the two libraries have different DOM structure, so this is a recreation of the look,
not a reuse of the actual select2 CSS rules.

## Revised scope

The original version of this decision scoped react-select only to pages that had select2
applied, and left the homepage calculator's plain `<select>`s alone (its markup in
`http/views/homecals.cfm` never had a select2 class). In practice, once the calculator was
built, unstyled native `<select>`s sitting next to `Input`-styled text fields looked
inconsistent enough to be reported as looking "trashy." Standardized on `Select` for every
dropdown in the app instead of tracking which legacy page happened to apply select2 — one
dropdown component, one look, everywhere.

## How to apply

New dropdowns use `Select` (`src/components/ui/Select.tsx`), not a bare `<select>`. Options are
passed as `{ value, label }[]`; `required` renders a hidden native input so HTML5 form
validation still works the same way the original `required` attribute did.
