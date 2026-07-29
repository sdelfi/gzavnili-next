# 0007 — Move large CSS `background: url()` images to `next/image`, not just `<img>`

**Status:** implemented for `OfferParallax.tsx` (`home-special-big.jpg`, 330 KB).

## Problem

`public/css/additional.css`'s `#offer-parallax` rule loaded `home-special-big.jpg` (330 KB) as
a flat CSS `background: url()`. CSS can't call a React component, so `next/image` (which is
how this project gets automatic responsive sizing + modern-format negotiation — see below)
never applied to it, unlike the `<img>` tags already converted in
`docs/decisions/0006-no-vendored-legacy-js.md`'s wake — the same full-size JPEG always shipped
to every visitor regardless of viewport or browser format support.

## Decision

Where a CSS background image is large enough to matter for load performance, move it into the
component as an actual `<Image fill>` layer instead of leaving it as a stylesheet rule:

- The section gets `position: relative; overflow: hidden` (now just structural — see
  `additional.css`'s trimmed `#offer-parallax` rule).
- The `<Image>` is rendered as the first child with `fill` + `style={{ objectFit: "cover",
  zIndex: -1 }}` — `zIndex: -1` matters: an absolutely positioned element with `z-index: auto`
  still paints *above* static in-flow siblings by default CSS painting-order rules; only a
  negative z-index puts it back behind them within the section's new stacking context.
- Any JS that was manipulating `backgroundPosition` (here, the scroll-parallax effect that
  used to live in `../http/js/jquery.parallax-bg.js`) moves to a `transform: translateY()` on
  the `<Image>`'s underlying `<img>` ref instead.

Not a blanket rule for every CSS background in the app — small decorative backgrounds (icons,
repeating patterns) aren't worth the componentization. Apply this when the image is a large,
single, meaningful photo, the kind that shows up in a Lighthouse/PageSpeed report.

## Why this gets WebP/AVIF automatically

`next/image`'s built-in optimizer (`/_next/image`) content-negotiates the response format
against the request's `Accept` header — it serves AVIF or WebP to browsers that support them
and falls back to the original format otherwise, with no extra config (`images.formats`
defaults to `['image/avif', 'image/webp']` already). This only requires running the real
Next.js server (`next start`), which is exactly this project's deployment model — self-hosted
on our own VDS via HestiaCP's Node.js app proxy (see `README.md`'s Production section) — not a
static export or a platform without the optimizer. A plain CSS `background: url()` has no
equivalent built-in mechanism; reproducing format negotiation for it would mean hand-rolling
`image-set()` with manually pre-generated `.webp`/`.avif` files kept in sync by hand, which is
exactly the kind of manual step `next/image` exists to avoid.

## How to apply

Same pattern for any other large CSS background found while porting further pages — check
`grep -rn "background.*url(" public/css/*.css` for candidates before assuming a background
image has to stay a background image.
