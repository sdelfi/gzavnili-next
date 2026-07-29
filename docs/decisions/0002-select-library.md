# 0002 — react-select as the select2 replacement

**Status:** decided, not yet implemented (no page ported so far actually uses select2 markup).

## Decision

Use [react-select](https://react-select.com/) wherever the legacy site used select2
(`http/js/select2/`), instead of porting select2/jQuery itself.

## Why

There's no official React port of select2. select2 is used across the legacy account/
checkout/payment pages (`main.js`, `main2.js`) for searchable dropdowns (e.g. office picker
in `main.js` around the `deliveryOffice-col` select) — not on the homepage, whose calculator
(`http/views/homecals.cfm`) uses plain native `<select>` elements with no select2 class.
react-select was picked over a native-`<select>` + custom CSS approach because it's the most
widely used, actively maintained option and supports restyling via `classNamePrefix` close to
the current select2 look, without hand-building search/keyboard-nav behavior.

## How to apply

- When porting any page that used select2 (account, checkout, payment-steps — see
  `grep -rl select2 http/views` in the legacy repo for the full list), use react-select for
  those fields, styled via `classNamePrefix` against the ported `css/style.css` select2 rules
  rather than react-select's default theme.
- Plain `<select>` stays plain `<select>` where the legacy markup didn't apply select2 (as on
  the homepage calculator) — don't upgrade those without a reason.
- Add `react-select` to `package.json` when the first such page is actually ported, not before.
