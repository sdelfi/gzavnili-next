# Progress Log

Running record of what's been done in this project, checked off against the phases in
`docs/migrations/06-phased-rollout-plan.md` (moved here from the parent legacy repo's `../docs/`
— see `docs/README.md`). Newest entries at the top. This is a changelog, not a plan — see that
file for scope/sequencing.

## Phase 2 — Public static site (SSG) — in progress

- [x] Bootstrapped Next.js (App Router, TypeScript, bun, no Tailwind) — `240cbbe`, `4fd2c26`, `3d618c4`
- [x] Ported legacy homepage markup/CSS as-is (Header, Footer, homepage sections) from
      `../http/views/layouts/new.html` and `../http/views/home.html`, English branch only —
      same classes, so `../http/css/style.css` etc. apply unchanged — `4fd2c26`
- [x] Reimplemented every interactive behavior `main.js`/jQuery used to provide, as plain
      React components (no jQuery, no plugin scripts loaded): header dropdowns + office
      open-now indicator, tracking/login popovers (`Modal.tsx`), home slider (`HomeSlider.tsx`),
      FAQ accordion (`FaqAccordion.tsx`) — `240cbbe`
- [x] Local dev infra: `docker-compose.yml` (Postgres), `.env.example`
- [x] **Found: `../http/views/home.html` / `home_ge.html` are dead code, not the real homepage.**
      `../http/views/layouts/new.html:607` gates the include of those files behind
      `<cfif false and (...)>` — permanently disabled. The real homepage content is
      server-rendered from `request.pageContent`, which comes from `PageDAO.read()` and is
      cached on disk as `../http/include/pages/<sha1-hex-upper(url)>.json` (the `content` field,
      an HTML fragment with placeholder tokens like `{CALCULATOR}` substituted at render time —
      see `new.html:614-629`). Homepage cache file:
      `../http/include/pages/14FE4559026D4C5B5EB530EE70300C52D99E70D7.json` (sha1 of `/index.html`).
      Confirmed against the live site, https://usa.gzavnili.com/ — real hero is a
      `.main-parallax` section (car/boxes parallax layers + `#animated-strings` rotating text,
      styles in `../http/css/additional.css`, behavior in `../http/js/additional.js`), not the
      lightSlider carousel `home.html` has. Everything ported from `home.html` (incl.
      `HomeSlider.tsx`) needs redoing from the real cached content. Do NOT use `views/home*.html`,
      `views/layouts/new - Copy.html`, or `views/layouts/newhome.html` as a source again — treat
      any `views/*.html` as suspect until cross-checked against a `include/pages/*.json` cache
      file or the live site.
- [x] Rebuilt the homepage from the real cached content (see finding above), replacing
      everything sourced from the dead `home.html`: `HomeHero.tsx` (parallax hero +
      animated-strings rotator, mouse-parallax approximates `jquery.parallax.min.js`),
      `OfferParallax.tsx` (scroll background-position, replaces `jquery.parallax-bg.js`),
      real trustus/whychooseus copy, `VideoTutorials.tsx` (video-tutorials block that replaced
      the placeholder contact-form section — lightbox reuses `Modal.tsx`'s featherlight
      styling, not a real fancybox visual match), real FAQ items, real news items (image URLs
      still point at the legacy `gzavnili.com` domain, unchanged). Deleted `HomeSlider.tsx`/
      `.css`. Verified via `bun run build` + HTML-content smoke check against the dev server
      (no headless browser available in this environment to screenshot — flagged, not silently
      skipped).
- [x] Wired the homepage calculator (`Calculator.tsx`): ported the pricing/ETA formulas from
      `../http/views/homecals.cfm` (English branch) client-side — no server round-trip needed
      since the legacy logic was pure arithmetic on the GET params. Still plain native
      `<select>`s, matching the legacy markup (no select2 was applied to this particular form)
      — see `docs/decisions/0002-select-library.md` for the select2/react-select scope.
- [x] `docs/` restructured: moved the pre-implementation scoping package from the parent
      repo's gitignored `../docs/` into `docs/migrations/` (tracked here now), added
      `docs/decisions/` (see `docs/README.md`'s decisions log for the full list: no-monorepo,
      select2 replacement, mobile API, scheduled jobs, Cache Components, no vendored legacy JS),
      and a `docs/README.md` indexing everything plus the live-site reference
      (https://usa.gzavnili.com/). Removed `docs/migrations/08-cost-estimate.md` per client
      request.
- [x] Fixed the header's "Open Now"/"Closed Now" flash and made the office selection actually
      persist (it didn't before — reset to Tbilisi/English on every load): `Header.tsx` is now
      an async Server Component that reads the visitor's office from a cookie
      (`src/lib/preferences.ts`, `src/lib/offices.ts` — deliberately a cookie, not
      `localStorage`, which can't be read server-side) and computes the real open/closed status
      before first paint, in a single render. **First attempt used Next 16 Cache Components**
      (`cacheComponents: true` + a Suspense-streamed `HeaderPersonalized`) to keep the rest of
      the site statically generated — reverted after it caused a worse, client-visible bug: PPR
      always ships its (static, build-time) Suspense fallback first, so a visitor who'd picked
      "New York" saw "Tbilisi" flash on screen before correcting itself on every reload. Went
      with plain dynamic (per-request) SSR instead — one correct render, no swap, at the cost of
      the whole site now being `ƒ dynamic` rather than `○ static` in `next build`'s output (see
      `docs/decisions/0005-cache-components.md` for the full history/reasoning and why that
      trade-off is fine for now).
- [x] Deleted `public/bower_components/` and legacy `public/js/` (9.2 MB, nothing in `src/`
      loaded any of it) — `normalize.css` and the featherlight CSS classes `Modal.tsx` reuses
      are now a real npm package and an owned `Modal.css` respectively, not vendored copies.
      Also deleted two dead CSS files (`style.min.css`, a stale unloaded duplicate;
      `style_custom.20190912.css`, a dated backup). `eslint.config.mjs`'s stopgap
      `public/bower_components/**` ignore was removed again since the folder is gone. See
      `docs/decisions/0006-no-vendored-legacy-js.md` for what's intentionally still in
      `public/css/` (CSS for not-yet-ported pages) and why that's a different case. Fixed the
      two real lint errors this work surfaced along the way (`react-hooks/immutability` on a
      `document.cookie` write; `<a href="/">` → `next/link` in `Header`/`Footer`) — everything
      in `src/` now lints clean (0 errors).
- [x] Added `src/lib/routes.ts` (`routes.home()`, `routes.login()`, `routes.page("slug")` for
      static marketing pages, etc.) and switched every internal `href`/`action` in
      `Header`/`HeaderClient`/`Footer`/`page.tsx` to it — see AGENTS.md's new "Routing" rule.
- [x] Added `src/components/ui/` (Input, Select, Lightbox) per AGENTS.md's new "Shared
      components" rule, and switched every existing `<input>`/`<select>` over to them
      (`Calculator.tsx`, `HeaderClient.tsx`'s tracking/login modals, `Footer.tsx`'s newsletter
      field):
      - `Select` wraps `react-select` (finally added the dependency —
        `docs/decisions/0002-select-library.md`), `unstyled` + custom `Select.css` recreating
        select2's look (border/height/colors, same `icons.png` sprite for the arrow). Scope
        widened from the original decision: applied to *every* dropdown, not just ones that
        happened to have select2 in the legacy markup — plain native `<select>`s next to
        styled `Input`s looked inconsistent (reported as looking "trashy"). Hit and fixed a
        real hydration-mismatch bug here: react-select needs an explicit, stable `instanceId`
        per instance (made it a required prop on our wrapper) — without one it falls back to a
        module-level render counter that's shared across requests on the server but resets on
        the client, guaranteed to mismatch.
      - `Lightbox` replaces `VideoTutorials`' earlier (reused) `Modal`/featherlight styling —
        the real homepage wires video thumbnails to fancybox, not featherlight, so this is a
        second, separate visual recreation (own CSS, no sprite images) matching fancybox's
        skin instead, since the two are deliberately different lightbox styles in the legacy
        design system (featherlight for auth popovers, fancybox for media).
- [x] Converted every `<img>` to `next/image` (`Header`'s logo, homepage `trustus` image,
      `VideoTutorials` thumbnails) — all local, known-dimension images. Left the homepage news
      section's images as plain `<img>` (documented with an inline comment): they're external,
      hotlinked from the legacy `gzavnili.com` domain with unknown/varying dimensions, and
      transitional (real news content isn't migrated yet) — not worth an
      external-domain `next/image` config for content that's going away.
- [x] Fixed real UI bugs reported after visual review against https://usa.gzavnili.com/:
      - `Select.css`: dropdown options were bold (`font-weight: 600`, copy-pasted from the
        closed-control value's styling by mistake) — only the closed/selected value should be
        bold per the real select2 look; options are `400`.
      - Calculator's required-field errors were showing the browser's native "Please fill out
        this field" bubble instead of our custom `<label class="error">` — react-select's
        `required` prop renders a hidden native `<input required>`, and native HTML5
        validation blocks form submission (hence our `onSubmit` handler) before it ever runs.
        Added `noValidate` to the form; `Input`/`Select` now both take an `error?: string` that
        renders the jquery.validate-style `<label class="error">` this site actually uses
        (`../http/views/homecals.cfm`'s `jQuery('.pricecalc_form').validate();`), wired into
        Calculator's two required selects.
      - **The tracking/login modal looked visibly different from the real site** (close icon,
        overlay darkness, spacing). Root cause: `public/css/style.css` already carries this
        site's *real* featherlight overrides (overlay `rgba(0,0,0,.5)`, content
        `padding:35px 20px 25px`, and — the visible giveaway — a real close-icon *graphic* from
        the `icons.png` sprite, not text) — see style.css around line 837. `Modal.css` (written
        from generic featherlight defaults when `bower_components` was deleted, per
        `docs/decisions/0006-no-vendored-legacy-js.md`) redeclared those same properties with
        different values and — since it loads after the global stylesheets — silently won,
        fighting the real design instead of matching it. Trimmed `Modal.css` to only the
        structural rules style.css never had to define (positioning/centering — those were
        always the plugin's job, not the site's CSS); removed `Modal.tsx`'s hardcoded inline
        `background: rgba(0,0,0,.8)` (was overriding the real `.5` from CSS) and its unicode
        "✕" glyph (now real but visually hidden via `text-indent`, letting style.css's sprite
        background show through, matching the original close-icon graphic exactly).
      - `#offer-parallax`'s 330 KB background image (`home-special-big.jpg`) moved from a CSS
        `background: url()` (in `additional.css`) into `OfferParallax.tsx` as a real
        `next/image` layer (`fill` + `zIndex: -1` to sit behind the static `.container`
        content — an absolutely positioned `z-index: auto` element still paints above static
        siblings by default). Gets automatic AVIF/WebP content-negotiation for free from
        Next's built-in image optimizer (works because production runs the real Next server on
        our own VDS, not a static export) — a CSS background has no equivalent. See
        `docs/decisions/0007-next-image-for-css-backgrounds.md`.
      - Added `tooltipster.bundle.min.css`/`tooltipster-sideTip-light.min.css` to the root
        layout — found while auditing `public/css/` for cruft (client asked "тут все css
        нужны?"): unlike `bootstrap.min.css`/`grid.css`/`jquery.dataTables.min.css`/
        `loginpage*.css`/`paymentsteps.css` (genuinely not referenced anywhere yet — still
        under investigation, see below), tooltipster is loaded unconditionally on *every* page
        in `../http/views/layouts/new.html`, so it was a real missing dependency, not
        speculative future-page cruft. The actual tooltip *behavior* (JS init, likely for the
        calculator's `icon-info` hint) isn't wired yet — CSS-only fix so far.
- [ ] Finish the `public/css/` cruft audit: confirm whether `bootstrap.min.css`, `grid.css`,
      `jquery.dataTables.min.css`, `loginpage.css`/`loginpage.src.css`, `paymentsteps.css` are
      referenced by any legacy page (checked `new.html` — not there; still need to check
      `account`/`paymentSteps`/`authenticate` view fragments for inline `<link>` tags before
      deleting anything) — interrupted by a Bash tool outage in this session.
- [ ] Wire the calculator's `icon-info` tooltip (tooltipster) now that its CSS is loaded.
- [ ] Download the homepage news images into `public/img/news/` and switch `page.tsx`'s
      `NEWS_ITEMS` off the external `usa.gzavnili.com` hotlinks to local relative paths —
      interrupted by the same Bash outage (network fetches specifically kept failing).
- [ ] Georgian-language branch of Header/Footer/homepage (currently English-only)
- [ ] Remaining public/marketing pages (services, cargo, courier, pricing, FAQ, legal/customs, news)
- [ ] Public unauthenticated tracking page wired to real Postgres data (Phase 1 schema/backend
      not built yet — this page is currently just a UI shell/modal)

## Not started

- Phase 0 (audit), Phase 1 (Postgres schema/backend), Phase 3 (authorized zone), Phase 4 (bema
  admin), Phase 5 (mobile API), Phase 6 (cron), Phase 7 (cutover) — see the rollout plan.
