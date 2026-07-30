# 0006 — No vendored legacy JS bundles; own/modern replacements only

**Status:** confirmed, partially executed.

## Decision

`public/bower_components/**` and the legacy `public/js/**` (jQuery, jQuery plugins, select2,
lightSlider, fancybox, tooltipster, dataTables, etc.) don't belong in this project. Every
behavior those scripts provided gets reimplemented as plain React (already the pattern for
everything ported so far — see `PROGRESS.md`) or, where a genuine library is warranted, pulled
in as a real npm dependency (e.g. `docs/decisions/0002-select-library.md`'s react-select) —
never as a copy-pasted vendor bundle sitting in `public/`.

## What's been done

- Deleted `public/bower_components/` (8.1 MB) and `public/js/` (1.1 MB) entirely — nothing in
  `src/` referenced their JS (confirmed: no ported page loads any plugin script), and the two
  CSS files that were still linked from them are now handled properly instead:
  - `normalize.css` → the real `normalize.css` npm package, imported in `layout.tsx`, not the
    vendored copy.
  - `featherlight.min.css` → `Modal.tsx`'s styling only ever reused this file's class names
    (`.featherlight`, `.featherlight-content`, ...) — `Modal.tsx` never loaded featherlight.js.
    Replaced with `src/components/Modal.css`, our own formatted (not minified) copy, imported
    directly by `Modal.tsx`.
- Also removed two dead files that were never a "vendor bundle" but were pure cruft: a
  minified duplicate (`public/css/style.min.css`, unloaded, would've silently drifted out of
  sync with `style.css`) and a dated backup (`public/css/style_custom.20190912.css`).

## What's still there, deliberately, and why it's not "the same problem"

`public/css/{bootstrap.min.css, paymentsteps.css, tooltipster*.css, jquery.dataTables.min.css,
geo.css}` are still present. These are **not loaded by any ported page today** — they're
legacy CSS for pages/features not yet built (payment steps, account dataTables, the
Georgian-language branch). They're kept as porting reference material, the same way
`../http/views/*.html` is (with the same caveat: verify against `include/pages/*.json`/the
live site before trusting one, per `PROGRESS.md`). Delete each one only once the page it
belongs to is actually ported and confirmed not to need it — not speculatively now, and not
left behind once that porting happens either.

(`loginpage.css`/`loginpage.src.css`/`grid.css` used to be on this list — all three have
since been retired: their few actually-needed rules were ported into
`src/components/auth/AuthLayout/AuthLayout.module.css` once the login page's pixel-parity
pass needed them, see `docs/decisions/0012-customer-auth.md`. `public/css/static.css` is a
different thing entirely — not legacy cruft, a deliberately-uncurated live copy of prod's
stylesheet backing the Site Pages CMS, see `docs/decisions/0013-site-pages-cms.md`.)

## How to apply

Before porting any further legacy page: check whether it references a `bower_components` script
in the source `.cfm`/`.html` — if so, that's a signal to reimplement in React (per the pattern
in `src/components/`) rather than re-link the vendor file, exactly as `HomeHero.tsx` replaced
lightSlider, `Modal.tsx` replaced featherlight.js, and `Calculator.tsx` replaced the server-side
form-reload flow.
