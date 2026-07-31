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
      field): - `Select` wraps `react-select` (finally added the dependency —
      `docs/decisions/0002-select-library.md`), `unstyled` + custom `Select.css` recreating
      select2's look (border/height/colors, same `icons.png` sprite for the arrow). Scope
      widened from the original decision: applied to _every_ dropdown, not just ones that
      happened to have select2 in the legacy markup — plain native `<select>`s next to
      styled `Input`s looked inconsistent (reported as looking "trashy"). Hit and fixed a
      real hydration-mismatch bug here: react-select needs an explicit, stable `instanceId`
      per instance (made it a required prop on our wrapper) — without one it falls back to a
      module-level render counter that's shared across requests on the server but resets on
      the client, guaranteed to mismatch. - `Lightbox` replaces `VideoTutorials`' earlier (reused) `Modal`/featherlight styling —
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
- [x] Fixed real UI bugs reported after visual review against https://usa.gzavnili.com/: - `Select.css`: dropdown options were bold (`font-weight: 600`, copy-pasted from the
      closed-control value's styling by mistake) — only the closed/selected value should be
      bold per the real select2 look; options are `400`. - Calculator's required-field errors were showing the browser's native "Please fill out
      this field" bubble instead of our custom `<label class="error">` — react-select's
      `required` prop renders a hidden native `<input required>`, and native HTML5
      validation blocks form submission (hence our `onSubmit` handler) before it ever runs.
      Added `noValidate` to the form; `Input`/`Select` now both take an `error?: string` that
      renders the jquery.validate-style `<label class="error">` this site actually uses
      (`../http/views/homecals.cfm`'s `jQuery('.pricecalc_form').validate();`), wired into
      Calculator's two required selects. - **The tracking/login modal looked visibly different from the real site** (close icon,
      overlay darkness, spacing). Root cause: `public/css/style.css` already carries this
      site's _real_ featherlight overrides (overlay `rgba(0,0,0,.5)`, content
      `padding:35px 20px 25px`, and — the visible giveaway — a real close-icon _graphic_ from
      the `icons.png` sprite, not text) — see style.css around line 837. `Modal.css` (written
      from generic featherlight defaults when `bower_components` was deleted, per
      `docs/decisions/0006-no-vendored-legacy-js.md`) redeclared those same properties with
      different values and — since it loads after the global stylesheets — silently won,
      fighting the real design instead of matching it. Trimmed `Modal.css` to only the
      structural rules style.css never had to define (positioning/centering — those were
      always the plugin's job, not the site's CSS); removed `Modal.tsx`'s hardcoded inline
      `background: rgba(0,0,0,.8)` (was overriding the real `.5` from CSS) and its unicode
      "✕" glyph (now real but visually hidden via `text-indent`, letting style.css's sprite
      background show through, matching the original close-icon graphic exactly). - `#offer-parallax`'s 330 KB background image (`home-special-big.jpg`) moved from a CSS
      `background: url()` (in `additional.css`) into `OfferParallax.tsx` as a real
      `next/image` layer (`fill` + `zIndex: -1` to sit behind the static `.container`
      content — an absolutely positioned `z-index: auto` element still paints above static
      siblings by default). Gets automatic AVIF/WebP content-negotiation for free from
      Next's built-in image optimizer (works because production runs the real Next server on
      our own VDS, not a static export) — a CSS background has no equivalent. See
      `docs/decisions/0007-next-image-for-css-backgrounds.md`. - Added `tooltipster.bundle.min.css`/`tooltipster-sideTip-light.min.css` to the root
      layout — found while auditing `public/css/` for cruft (client asked "тут все css
      нужны?"): unlike `bootstrap.min.css`/`grid.css`/`jquery.dataTables.min.css`/
      `loginpage*.css`/`paymentsteps.css` (genuinely not referenced anywhere yet — still
      under investigation, see below), tooltipster is loaded unconditionally on _every_ page
      in `../http/views/layouts/new.html`, so it was a real missing dependency, not
      speculative future-page cruft. The actual tooltip _behavior_ (JS init, likely for the
      calculator's `icon-info` hint) isn't wired yet — CSS-only fix so far.
- [ ] Finish the `public/css/` cruft audit: confirm whether `bootstrap.min.css`, `grid.css`,
      `jquery.dataTables.min.css`, `loginpage.css`/`loginpage.src.css`, `paymentsteps.css` are
      referenced by any legacy page (checked `new.html` — not there; still need to check
      `account`/`paymentSteps`/`authenticate` view fragments for inline `<link>` tags before
      deleting anything) — interrupted by a Bash tool outage in this session.
- [ ] Wire the calculator's `icon-info` tooltip (tooltipster) now that its CSS is loaded.
- [x] Downloaded the homepage news images into `public/img/news/` and switched `NEWS_ITEMS`
      off the external `usa.gzavnili.com` hotlinks to local relative paths.
- [x] Adopted a per-component folder convention (`ComponentName/ComponentName.tsx` +
      `.module.css` + `index.ts`, see `HomeHero/` for the original example) instead of one
      flat `src/components/*.tsx` file per component with styling left in the global
      `public/css/*.css` files — see AGENTS.md's "shared components" rule. Decomposed under
      this convention so far: `HomeHero`, `HeaderClient`, `OfferParallax`, `TrustUs`,
      `WhyChooseUs`, `MobileApp`, `News`. Each migration deletes its rules from
      `public/css/style.css`/`style_custom.css` (not just adds the module) so there's one
      source of truth per rule, not a fork — grouped selectors that mix in something outside
      the component's scope (e.g. `#login-block .or span, #login-block p, .trustus ...,
.whychooseus ...` sharing one `font-family: Montserrat` declaration) are left in place
      and the value is duplicated into the module rather than splitting/deleting the shared
      rule. - Doing this for `HeaderClient` surfaced the actual tracking/login modal styling bug:
      the real design has dedicated `#tracking-block`/`#login-block` rules in `style.css`
      (centered `h3`, constrained form width, a `#login-block` "or" divider + copy) that our
      markup never had the hooks for — now `.trackingBlock`/`.loginBlock` module classes. - Responsive migration is now complete for every homepage component (`HeaderClient`,
      `Footer`, `HomeHero`, `TrustUs`, `WhyChooseUs`, `MobileApp`, `News`, `Faq`/
      `FaqAccordion`, `VideoTutorials`) — all their `@media` rules have been ported out of
      `style.css` into the matching `.module.css`, verified by re-grepping `style.css` for
      each component's selectors after each migration.
- [x] Added Prettier (`.prettierrc.json`: singleQuote, trailingComma all, printWidth 120) +
      `eslint-config-prettier` (disables stylistic ESLint rules that'd fight Prettier) +
      `bun format`/`bun format:check` scripts, then ran it once across the whole repo to
      normalize the quote-style split that had crept in (older files double-quoted, newer
      component-folder files single-quoted).
- [x] **Georgian-language branch of the homepage is done.** Set up i18n scaffolding with
      next-intl (`en`/`ge` locale ids matching the legacy `session.language` convention, `/ge/`
      prefix, `en` unprefixed — see `docs/decisions/0008-i18n-next-intl.md`): `[locale]` segment
      routing, `src/proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts` — heed the
      deprecation warning if you ever rename it back), `messages/en.json`/`messages/ge.json`.
      Every homepage component (`Header`/`HeaderClient`, `Footer`, `HomeHero`, `TrustUs`,
      `SpecialOffer` (now inside `OfferParallax.tsx`), `WhyChooseUs`, `Calculator`, `Faq`,
      `VideoTutorials`, `MobileApp`, `News`) now reads its copy from translations instead of
      hardcoded strings. The Georgian copy isn't machine-translated — pulled from the legacy
      app's real Georgian content: `../http/include/pages/E4562B44D65122F4B36660EF1DA9F9FE81A58F58.json`
      (the `PageDAO` cache for `/ge/index.html`, found the same way as the English homepage
      cache) plus `../http/views/layouts/new.html`'s `<cfif session.language eq "ge">` branches
      for header/footer nav. Language switcher in the header now does a real locale switch
      (next-intl's locale-aware `Link`/`usePathname`), not a dead link. Verified end-to-end at
      runtime: `/` (English) and `/ge` (Georgian) both serve correct translated content,
      `/ge/` → `/ge` redirects correctly, switching locale sets a `NEXT_LOCALE` cookie.
      Every other page ported later needs the same treatment — see the decision doc's "Known
      gaps" section for how to source real Georgian copy rather than inventing it.
- [x] Finished migrating the remaining homepage-component CSS out of `public/css/style.css`
      into `.module.css` files (client: "не перенесено много стилей... давай лучше ты").
      `Footer/Footer.module.css` completed (base + 1139/767/599px media, 391 lines removed
      from `style.css`). Split the old flat `FaqAccordion.tsx` into `FaqAccordion` (the
      reusable list/item styling, made self-contained instead of requiring an ancestor
      `.faq`) and a new `Faq` component (section chrome: heading + "see all answers" link),
      wired `<Faq/>` into `src/app/[locale]/page.tsx` in place of the old inline markup.
      Migrated `VideoTutorials` into its own folder, merging the live base/responsive rules
      from `style.css`'s `.videohelp ...` selectors with the real card styling
      (`.videohelp .videos .item .inner...`) that had been hiding in `src/app/globals.css`
      (merged in from the deleted `style_custom.css`) — and dropped the dead
      `.videohelp .videos .item a`/`a i`/`a p`/`a:hover...` rules for an older markup
      variant this component's real `<a class="item"><div class="inner">` structure never
      matches. `.row.faq-quesions-block`/`.row.faq-videos-block>.col-6...` page-composition
      glue rules deliberately left in `style.css` (shared between two components, not owned
      by either — same treatment as other page-glue rules noted above). Ran a naming pass
      across every `.module.css`: no leftover kebab-case local selectors, no declared-but-
      unused local classes. Commit: dedf0f6 (formatting) plus the uncommitted changes from
      this session — see `Faq`/`FaqAccordion`/`VideoTutorials`/`Footer` folders.
- [x] Added `typed-css-modules` (`bun run css-types`, wired into `predev`/`prebuild`) to
      generate `.module.css.d.ts` sidecars so referencing a CSS Modules class that doesn't
      exist is a build-time TypeScript error — the tooling the client asked for to catch
      "kebab-case forgotten to be renamed to camelCase" migration bugs. Tried
      `eslint-plugin-css-modules` first; confirmed via a deliberate broken reference that it
      silently detects nothing (unmaintained) and removed it. See
      `docs/decisions/0009-css-modules-type-checking.md`. Caught two real pre-existing bugs
      this session: `HomeHero.tsx`'s dead `s.parallaxLayer` reference, and `Footer.tsx`'s
      `s.social` reference which only existed as a non-exported `:global(.social)` in
      `Footer.module.css` (fixed by making `.social` a real local class, matching how
      `.title` is already handled).
- [x] **Phase 1 database foundation implemented**: Prisma 7 schema (`prisma/schema.prisma`) + initial migration (`prisma/migrations/20260730161912_init/`) standing up the full
      parcels-domain redesign from `docs/migrations/04-postgres-schema-design.md` — `users`,
      `addressbook`, `receivers`, `parcels` (extended with `status`/`is_paid`/`is_invoiced`/
      `invoice_id`/`invoice_amount`/`office_name`), `invoices`/`invoices_items`, `payments`,
      `parceloffice`/`delivery_offices`, `config` (single-row, `CHECK`-enforced), `user_balances`,
      `parcel_status_history`. Hand-written SQL (Prisma's DSL can't express this) implements
      the single authoritative status trigger (`fn_recompute_parcel_status`, replacing the
      8-10 drifted copies in the legacy code) plus denormalization triggers for office name,
      invoice/paid state, and the per-user balance aggregate — all smoke-tested manually
      against the local docker-compose Postgres (status waterfall, office rename
      propagation, invoice/payment denorm all verified end-to-end). See
      `docs/decisions/0010-prisma-migrations.md` for: the Prisma 7 setup specifics (driver
      adapters, `prisma.config.ts`), the migration-safety policy (`bun run db:migrate` for
      local only, guarded by `scripts/guard-local-db.mjs`; `bun run db:migrate:deploy` is
      the only command production ever runs; no `db:push`/`db:reset` script exists at all),
      and — important — an explicit re-confirmation with the client that Postgres (not
      MySQL, which the client had actually said they preferred for hosting-familiarity
      reasons) is the right call here, given the trigram/partial-index search wins this
      schema specifically needs. The status priority-order question
      (`docs/migrations/07-risks-and-open-questions.md` #1) is implemented provisionally
      (hold flags first), not resolved — flagged in both that doc and the schema/migration
      comments.
- [ ] Phase 1 NOT complete: the MSSQL→Postgres ETL/backfill scripts and reconciliation
      checks from `docs/migrations/05-data-migration-strategy.md` still need to be built —
      no MSSQL source was reachable from this environment to build/test them against.
- [x] Added `deploy.sh`: single-command production deploy (pull → `bun install` →
      `bun run db:migrate:deploy` → `bun run build` → PM2 restart), adapted from a
      reference script the client provided from another project (pnpm/backend-frontend
      split there; this app is a bun/Next.js monolith, so that split and its seed step
      don't apply here). This is the intended entrypoint for a future GitHub-webhook
      auto-deploy. Added a matching AGENTS.md rule: schema/migration DDL must come from
      Prisma's generator, not be hand-written, except for the specific triggers/constraints/
      operator-class indexes Prisma's schema language can't express (see
      `docs/decisions/0010-prisma-migrations.md`).
- [ ] Remaining public/marketing pages (services, cargo, courier, pricing, FAQ, legal/customs, news)
- [ ] Public unauthenticated tracking page wired to real Postgres data (schema now exists,
      per above — this page is still currently just a UI shell/modal, not wired up)
- [ ] `contact.html`: currently listed in `routes.ts`'s `StaticPageSlug` as if it were a
      generic admin-authored Site Pages CMS page, but legacy actually serves it from its own
      dedicated template (`../http/views/contact.html`), not the CMS content system. Needs
      checking against that legacy template and porting as its own page/component rather
      than assumed to be CMS-driven content. Not started — flagged only, per explicit
      instruction not to implement yet.

## Phase 4 — bema admin (CSR) — in progress

Started ahead of the rollout plan's own sequencing (Phase 4 normally follows Phases 1-3),
per explicit client request: auth + user management first, as the foundation the rest of
bema builds on. See `docs/decisions/0011-bema-admin.md` for the full research/design
writeup (legacy `edit_users.cfm`/`users.cfm` behavior, what was deliberately simplified,
why).

- [x] **Standalone Receivers screen** (legacy `bema/parcels/{receivers,receivers-update,
      receivers-delete}.cfm` + `views/parcels/{vwReceivers,vwReceiversUpdate}.cfm`) — the
      management screen the parcel form's `ParcelReceiverSection` picker never had: browse/
      search/paginate all receivers (optionally scoped to one customer), add/edit one
      directly, deactivate one — none of which required a parcel in the loop before this.
      `Receiver.active` (`Boolean @default(true)`) added to the schema (migration
      `20260801120000_receiver_active`) for legacy's `Status` soft-delete, which had no
      column at all previously. `GET /api/bema/receivers` is now dual-mode: unchanged
      `{ receivers }` shape when called with just `?userId=` (the parcel form's picker,
      untouched), paginated/searchable `{ items, total }` when called with `?page=` (the new
      list screen) — same route, so the two callers can't drift. New `POST`/`PATCH /api/bema/
      receivers/[id]` (create/update, admin-only per legacy's stricter
      `WEBSITE_ADMINISTRATOR,ADMINISTRATOR` gate on writes vs. the broader browse/picker
      access) and `DELETE` (soft delete, sets `active=false`) reuse `upsertReceiver()` from
      `parcelShared.ts` rather than duplicating the address-upsert logic a third time.
      `receiverSchema.ts` mirrors legacy's `ReceiverUpdate.cfc` validation (first/last name
      and city and phone1 always required, state+postal code required unless country is
      "GE") — deliberately stricter than, and independent of, the parcel form's own relaxed
      inline validation (`ParcelDraftModal.tsx`), which is untouched. New: `ReceiverListPage`/
      `ReceiverForm` (`src/components/admin/receivers/`), `/bema/receivers` (+`/new`,
      `/[id]`), sidebar's pre-existing unlinked "Receivers" placeholder now wired to
      `routes.bema.receivers()`. **Not ported**: legacy's known-country-list validation on
      the Country field (no such list exists in this codebase — the field stays free-text,
      matching `ParcelReceiverSection`'s existing 2-letter Country input) and the
      `findReceiver()` name/city/user uniqueness lookup (only used by the customer-facing
      self-service address book, `receiverUniqCheck.cfm`, which is out of bema's scope).
- [x] **Two Parcels-list bugs found while smoke-testing the Receivers work above** (browsing
      `/bema/parcels` with bench-seeded data surfaced both — neither is receivers-related,
      fixed in the same pass since they were live blockers for verifying anything on that
      screen): (1) the "Received By" select showed "Any" on first load even though the API
      had already scoped the results to the logged-in admin (`ParcelListPage`'s
      `ParcelExtraFilters` remount `key` didn't include `effectiveReceivedBy`, which only
      arrives one render after mount — see the code comment now on that `key`). (2)
      Explicitly picking "Received By: Any" did nothing — `receivedBy=''` was
      indistinguishable from "not yet touched" and always fell back to self-scoping; now
      sends an explicit `RECEIVED_BY_ANY` sentinel instead (`src/lib/parcels/constants.ts`).
      Full root-cause (a legacy HTML-form accident this schema has no equivalent of) in
      `docs/findings.md`'s "Parcels list Received By: Any" entry.
- [x] **Parcels list: shipment-card header was missing half its action row.** `ParcelGroupCard`
      had Group pay, Code, Customer info and All parcels, but silently dropped legacy's
      "Customer account" (login-as-customer — same open design question as the row-level
      "Login as user" in `UserListPage`), "Generate Invoice"/"View Invoice", and "Print" —
      not decided against, just never added. All three now render as inert placeholders with
      a title, matching the convention `ParcelRowActions` already established for the exact
      same kind of gap (target screen not built yet) rather than being dropped outright.
      Also fixed a latent dead `className={s.headerActions}` reference on that row's `<th>`
      (a CSS Modules class that never existed, caught once `bun run css-types` was re-run —
      harmless at runtime, just never applied).

- [x] **Parcel edit screen** (`bema/parcels/parcels-update.cfm` + `views/parcels/
      vwParcelsUpdate.cfm`, ~1,900 lines between them — the item flagged as "the big one" in
      the parcels follow-ups below). Full field set in legacy's own five groupings, each its
      own component: `ParcelDetailsSection` (tracking #s with the live duplicate check,
      customer picker, trip date, service, AWB, content, store), `ParcelReceiverSection`
      (receiver dropdown that refills the address block, GE-citizen name pairs, delivery
      office), `ParcelCustomerSection`, `ParcelPricingSection` (weight/value/dimensions →
      dimensional weight → suggested price, partial payment, mark paid/unpaid, location,
      group, notes) and `ParcelTrackingDatesSection` (all 12 milestones + received-by/
      delivered-by). Validation ports `validation/bema/ParcelUpdate.cfc` plus the two checks
      the controller does inline (notes required when weight or amount changes; payment
      method required when marking paid). The save is the same five-part sequence legacy
      does — parcel, receiver (created when "< New Receiver >"), the sender's name and
      billing address, delivery-office assignment, then a `paid`/`unpaid` operation — but
      the first four are one transaction. New: `src/lib/services/{parcelUpdate,parcelDetail}
      .ts`, `src/lib/parcels/{form,pricing}.ts`, `src/lib/validation/zodErrors.ts`,
      `GET`/`PATCH` on `/api/bema/parcels/[id]`, plus `/api/bema/parcels/[id]/clear-hold`,
      `/api/bema/parcels/check-tracking`, `/api/bema/receivers`,
      `/api/bema/delivery-offices`. `ui/Textarea` promoted to the shared set (fifth
      hand-rolled `<textarea>` in the codebase). The list's Edit action is now a real link,
      threading `returnTo` so a save lands back on the same filtered page.
      **Legacy bugs fixed rather than reproduced** (full table in decision 0015): the save
      had no transaction at all; `goWeight()` recalculated the price on every keystroke and
      silently overwrote a hand-set Amount (now a suggestion with a "Use" button and its
      reasoning shown); an `alert()` fired on every service/trip-date change; each receiver
      selection cost a second request; zod's `flatten()` couldn't say which nested field
      failed (`flattenIssues()` keys by dotted path now). **Divergences**: `isgecitizen` is
      derived from whether a Georgian-script name exists (this schema has no such column);
      legacy's hard-coded `officeid = 999` "Need delivery" pseudo-office can't round-trip
      through a real FK and belongs in `delivery_offices` as data.
      Verified end-to-end against the local Postgres + dev server: detail load, save,
      each validation rule, duplicate-tracking 409, mark paid/unpaid, and — in headless
      Chromium — receiver switching refilling the address, dimensional weight recomputing,
      the price suggestion following the larger weight, and the delivery-office dropdown
      loading.

- [x] **Parcels list performance, measured at 1M rows** (docs/decisions/0016-parcels-
      performance.md) — the client's stated reason for this whole migration, and until now
      only tested against a four-row fixture. Seeded a throwaway Postgres with 1M parcels /
      650k invoices+payments / 20k customers and ran the real API. The schema redesign's own
      fixes held up as designed (status filter: 6ms; the "Paid" filter that used to be a
      correlated subquery: 1.2ms), but three things broke at volume and are now fixed:
      **keyword search** (1.1-2.9s → 3ms) — the search spans two tables with an OR, which no
      index can serve across a join, so `parcels.search_text` denormalises every searchable
      field from both tables into one trigger-maintained column with a GIN trigram index (new
      migration `20260731210000_parcels_search_and_indexes`); **milestone date filters**
      (1971ms → 1ms) — ten partial indexes, one per tracking milestone, `WHERE col IS NOT
      NULL`; **the exact row count** (200-525ms → 3ms) — capped at 10,000 (`totalIsExact` in
      the response, rendered as "10,000+" past the cap; legacy always computed the exact
      count and paid for it on every page load); and, found along the way, **the sender
      filter** (5.5s → 0.13s) — Prisma emitted one correlated subquery per OR branch when the
      filter was six parcel-level conditions; restructured as one `user` relation filter, one
      subquery. Full before/after table for every filter in the decision doc.
      **New: `scripts/benchmark-parcels.ts`** (`bun run benchmark:parcels`) — reproduces the
      whole benchmark against any database (`--seed --scale=N --confirm=<db name>`, then
      `--bench` drives the real endpoints over HTTP and reports timings, `--reset` to wipe
      it), so a future change can be checked the same way instead of redoing this by hand.
      Verified it reproduces the same figures as the manual run, at both 50k and 1M scale.
- [x] **Two follow-up items from the parcels work resolved, not left as compromises**:
      `receivers.is_ge_citizen` is now a real column (migration
      `20260731220000_receiver_is_ge_citizen`, backfilled from the previous inference so no
      existing receiver flips) — the parcel form persists what the operator sets instead of
      re-guessing it from whether a Georgian-script name happens to be on file. And legacy's
      hard-coded `officeid = 999` "Need delivery" pseudo-office is now a real
      `delivery_offices` row (`scripts/seed-delivery-offices.ts`, idempotent, added to
      `db:seed`), so it round-trips through the real foreign key like every other office.
- [x] **Automated tests** (`bun test`, `bun run test`) — 81 tests across 6 files, all pure/
      unit-level (no database; the parcels domain's business logic is what regresses
      silently, not the framework wiring around it): `parcelQuery.test.ts` locks down every
      filter's exact Prisma shape (the status waterfall's exclusion lists, the debt filter's
      "0 means has-a-figure, not zero" rule, the sender/paid/city semantics) so a refactor
      that quietly drops an exclusion fails a test instead of surfacing as "an operator says
      the numbers look wrong"; `groupParcels.test.ts` covers the shipment-card grouping key
      and sort order; `pricing.test.ts` covers the price-suggestion schedule and customer
      pricing-rule precedence/date-range logic; `parcelSchema.test.ts` + `zodErrors` coverage
      lock down every validation rule ported from `ParcelUpdate.cfc`; `form.test.ts`
      round-trips the edit form's API-shape → input-values → payload conversions through the
      real server schema, so a dropped field fails loudly instead of silently saving as NULL;
      `format.test.ts` covers the date/money display helpers. Not covered yet (needs a
      running Postgres, unlike the rest): the API route handlers and the
      `saveParcel`/`runParcelOperation` service functions — worth adding once there's a
      standard way to spin up a disposable test database in CI, flagged rather than skipped
      silently.

- [x] **Password hashing is runtime-agnostic** (`src/lib/auth/password.ts`): `Bun.password`
      → argon2id via `hash-wasm`. Not a portability preference — a real outage: `next dev`/
      `next start` run route handlers under **Node** even when the server is launched with
      `bun`, so `Bun` was undefined there and every login 500'd with `ReferenceError: Bun is
      not defined`. bema auth did not work at all outside a Bun-native server. Chose pure
      WASM over a native addon (`@node-rs/argon2`) because `hash-wasm` inlines its WASM as
      base64 inside plain JS — nothing to mark external to the bundler, no per-platform
      prebuilt `.node`, and it breaks the same way `Bun.password` did if the runtime changes.
      Cost parameters deliberately match Bun's argon2id defaults exactly (m=65536 KiB, t=2,
      p=1, 32-byte output), so the swap is invisible: **existing hashes keep verifying** and
      no re-hash-on-login migration is needed. Verified under both runtimes against a running
      dev server: login with a hash written by the old `Bun.password` code succeeds, a
      password change rewrites it in the identical PHC format, login with the new password
      succeeds and the old one 401s, and the idle-lock `check-password` endpoint still
      accepts both the full and the short password and rejects a wrong one.

- [x] **Parcels list** (`bema/parcels/parcels.cfm` + `views/parcels/vwParcels_work2.cfm` — the
      live pair of four near-identical copies; see `docs/decisions/0015-bema-parcels-list.md`
      for how that was established and for the full port/divergence writeup). The whole
      screen: both search forms with every filter ported 1:1 (keyword/sender AND-of-ORs,
      trip/received/status dates, service-delivery-type grouped dropdown, group, city, status
      waterfall, paid, debt, plus the "extra search" milestone-range + Received By form),
      sender/trip/group card grouping, sortable + paginated, the bulk operations toolbar
      (delete, all nine status stamps, paid/unpaid with real invoice+payment creation,
      change code with the collision warning, set AWB with trip-date stamping), per-card
      Group pay, per-row delete and hold-clear, CSV export, the Delivery Request (`delreq`)
      slice with its Buser column and assign-and-send-out shortcut, and the agent-role
      restrictions (own parcels only, no operations toolbar) now enforced server-side.
      Layout: `src/components/admin/parcels/{ParcelListPage,ParcelFilters,ParcelExtraFilters,
      ParcelOperationsBar,ParcelGroupCard,ParcelRow,ParcelTrackingCell,ParcelPaymentCell,
      ParcelRowActions}`, `src/lib/parcels/{constants,types,format,groupParcels}.ts`,
      `src/lib/services/{parcelQuery,parcelOperations}.ts`,
      `src/lib/validation/parcelSchema.ts`, `src/lib/api/bema/parcels.ts`, and
      `/api/bema/parcels{,/[id],/operations,/export,/check-code}`. New shared UI primitives
      promoted to `src/components/ui/`: `Field` (labelled control, a pattern `UserForm`/
      `PageForm` had already hand-rolled) and `Checkbox` (needs the indeterminate state for
      the per-card select-all); `ui/Select` gained option groups and a compact `size="sm"`.
      **Found dead in legacy and not ported**: the "Recent Parcels" block (gated on a
      constant-false `<cfif … and 0>`, but still paying for a second full `getParcels()` scan
      on every request) and the `agentPrefix` argument (computed, passed, never referenced by
      the query). **Legacy bugs fixed rather than reproduced**: three status-filter options
      that silently returned an unfiltered list, a count-vs-page-query mismatch on the
      `office` filter, a GET link that mutated hold flags, the To-hour dropdown showing the
      From-hour, and unstable pagination with no sort tiebreaker — full table in decision
      0015. Schema additions (`parcels.pcode`, `parcels.b_paid_delivery`, `config.reg_awb`)
      in `prisma/migrations/20260731200000_add_parcel_pcode_paid_delivery/`.
      **Verified end-to-end this time, not just logic-level**: a throwaway local Postgres was
      stood up, the migrations applied, a fixture seeded, and every filter, every bulk
      operation, the CSV export, the auth guards (401/403/agent scoping) and the rendered
      screen exercised against a running dev server via HTTP and a headless browser (which
      caught one real defect — duplicate sibling React keys on the two filter forms).

- [x] **Auth**: two-realm JWT design (`bema_access_token`/`bema_refresh_token` httpOnly
      cookies, `jose`/HS256, 15min/7day TTLs, `BEMA_AUTH_SECRET`) — `src/lib/auth/{jwt,
cookies,session,login,password}.ts`. Password hashing via `Bun.password`
      (argon2id) — no external KDF dependency. Lockout logic (15 failed attempts → 15min
      lock, `SecurityLog` audit trail) ports the legacy thresholds exactly. `/api/bema/auth/
{login,logout,me,refresh}` route handlers. CSR-only client-side guard
      (`src/app/bema/(protected)/layout.tsx`) redirects unauthenticated visitors; real
      authorization is always enforced server-side per-route via `requireBemaSession`
      regardless of the client guard.
- [x] **User management** (`edit_users.cfm`/`users.cfm` equivalent): one shared list/form
      pair (`src/components/admin/users/{UserListPage,UserForm}.tsx`) parameterized by
      `accountType` (`BemaUser`/`Customer`), matching the legacy single-screen-for-both-
      `tid`-values design — not two separately-built features. `/api/bema/users` (list with
      search/filter/sort/pagination, create) + `/api/bema/users/[id]` (read/update, no
      delete — matches the legacy DAO's no-op `delete()` stub; deactivation is `active:
false` instead). Zod validation (`src/lib/validation/userSchema.ts`) ports the
      legacy `UserEdit.cfc` rules (username/email/password constraints, password-can't-
      contain-username, role-required-for-BEMA-accounts).
- [x] **Schema**: `AccountType`/`AdminRole` enums + auth/role columns on `User`, new
      `SecurityLog` table (`prisma/migrations/*_add_bema_auth/`) — collapses the legacy
      `TypeId` + `users_groups`/`groups` junction into two plain enum columns (documented
      simplification, see the decision doc — no real behavior lost, since every legacy
      account only ever had one effectively-active admin role despite the junction-table
      modeling). Customer discount/wholesale tiers (the `groups` table's other purpose) are
      explicitly out of scope.
- [x] Shared UI primitives added to `src/components/ui/` per the client's explicit ask:
      `Button` (primary/secondary/danger), `Table` (generic sortable/zebra data table),
      `Pagination` (windowed page-number strip, mirrors the legacy `pagination_admin.cfm`),
      `Alert`/`ErrorList` (replaces the legacy `Udf.displayErrors()` flash-banner pattern).
      Self-contained CSS Modules — bema doesn't load `public/css/style.css`.
- [x] Replaced the initial top-nav shell with a collapsible left sidebar
      (`src/components/admin/Sidebar.tsx`) per client request, ahead of the many more
      modules Phase 4 will add (parcels, products, orders, ...) — collapsed/expanded state
      persists in `localStorage`. Nav item list is data-driven (`NAV_ITEMS`), so adding a
      future module's link is a one-line addition, not a layout rework.
- [x] Fixed a routing bug found while testing: next-intl's `proxy.ts` middleware was
      rewriting `/bema/*` to `/en/bema/*` (nonexistent), 404ing every bema route — `/bema`
      is a separate, non-locale-prefixed route tree and needed an explicit matcher
      exclusion (`src/proxy.ts`).
- [x] `scripts/seed-admin.ts` (`bun run db:seed`) bootstraps the very first admin account
      (the panel is itself login-gated, so there's no other way in) — idempotent, a no-op
      once any `BemaUser` account exists.
- [x] Verified: real end-to-end smoke test against the local Postgres (wrong password
      rejected, correct password accepted, JWT sign/verify roundtrip, unknown user
      rejected, user create/search/cleanup via the actual Zod schema + Prisma queries the
      API routes use) — no dev server was available to test over real HTTP in this
      session (see the decision doc), so this exercised the underlying logic directly
      instead of skipping verification.
- [x] **Full-parity follow-up pass**, same session: client screenshotted the real live
      "Edit Customer" screen (`usa.gzavnili.com/bema/users/user_edit.cfm`) and the legacy
      sidebar and flagged that the initial user-edit form was missing most fields and the
      nav was missing most of the menu. Rebuilt to match — see
      `docs/decisions/0011-bema-admin.md`'s "Full-parity update" section for the full
      writeup. Summary: added `Address.title`/`email`/five distinct phone fields
      (replacing the earlier `phone1`/`2`/`3`), `User.shippingAddressId`/`importId`/
      `notifyViaMail`/`notifyViaSms`, a seeded `MessageType` reference table (14 rows,
      `bun run db:seed`) + per-user many-to-many notification preferences, and a new
      `CustomerPricingRule` model for the "Pricing Rules (Custom Rates & Discounts)"
      sub-section. `UserForm` rebuilt with a new `CollapsibleSection` ui primitive, a
      shared `AddressFields` component (billing + shipping blocks), the full
      notification-channel + per-event checkbox grid, and a `PricingRulesSection`
      (Customer accounts only). Sidebar rebuilt from a flat 2-item list into the full
      grouped structure transcribed off the legacy screenshot (CUSTOMERS/MESSAGES/
      COUPONS/CONTENT/CONFIGURATION/BEMA) — only Customers/BEMA Users are wired to real
      pages, everything else renders as a recorded-but-inert placeholder rather than being
      silently omitted. Added a `TopBar` showing "You today collect: —" (structurally
      present per client request, explicitly not wired to fabricated data — no
      collected-by-staff concept exists in the schema yet). Verified end-to-end via a
      direct Prisma smoke script (address create/update, notification-preference
      connect/set, pricing-rule create/delete) against the local Postgres — still no dev
      server available for real-HTTP/browser verification this session.
- [x] **Idle-lock modal** (short-password re-auth), ported from the legacy `bema.js`/
      `checkPassword.cfm` after reading that source directly: 5-minute idle timeout
      (mousemove/keypress reset, 20s poll, matching legacy exactly), non-dismissible
      modal, `/api/bema/auth/check-password` replicating the legacy's three-way
      result (own password unlocks; another active `BemaUser`'s short password
      switches the session to them + reloads; anything else is "Wrong password").
      Added `User.passwordShortHash` + a "Short Password" field in `UserForm`
      (BemaUser accounts only) — stored hashed (argon2id) rather than the legacy
      plaintext `PasswordShort` column, a deliberate security improvement with
      identical external behavior. See `docs/decisions/0011-bema-admin.md`'s
      "Idle-lock modal" section for the full writeup.
- [x] **Fixed: bema sessions silently died after 15 minutes** — `/api/bema/auth/refresh`
      (rotates the access/refresh token pair, sliding session) existed since the auth
      realm was first built but nothing ever called it, so the 15-minute access-token
      cookie just expired in any tab left open that long, 401ing every subsequent API
      call. Found via the idle-lock modal specifically (`check-password` returning "Not
      authenticated." — misreported as "Wrong password" by the old code) since a user is
      most likely to hit the expiry right after being idle-locked, but the bug affected
      the whole panel, not just that modal. Fixed at the root: `AuthProvider` now calls
      `/api/bema/auth/refresh` on a 10-minute timer for as long as a session is active.
      `IdleModal` additionally retries once through an explicit refresh+resubmit on a 401
      (defense in depth for a backgrounded/throttled tab that missed a timer tick) before
      falling back to a real logout, and no longer mislabels an expired-session 401 as a
      wrong password.
- [x] **UI polish pass**: sidebar was scrolling away with the page instead of staying
      pinned — made `position: sticky; top: 0; height: 100vh` with its own internal
      `.scrollArea` scroll instead of `max-height` on a normal in-flow block. Added a basic
      responsive breakpoint (768px) as groundwork only — `.shell` stacks to a single
      column, `UserForm`/`AddressFields`/`PricingRulesSection`'s 2-column grids collapse to
      1 column; not a full mobile redesign. `Table` padding tightened (`6px/10px`, 13px
      font) to match the legacy `table.browse`'s tight density instead of a roomy modern
      default. Users list: added the "Country" column for BEMA Users (legacy `vwUsers.cfm`
      shows it only for `tid eq 1`) via a `billingAddress: { select: { country } }` include;
      added the two action icons the Customers list was missing (legacy: "Login as
      reseller", "View Statement", both `tid neq 1`-only) as `IconButton` (new shared `ui/`
      icon-link component, inline SVG rather than vendoring the legacy PNGs). Edit/Add now
      carry a `returnTo` querystring param so saving/cancelling lands back on the exact
      list filter/sort/page state you came from, matching the legacy
      `user_edit.cfm`'s `location(form.rs)` — previously it always reset to page 1,
      unfiltered.
- [x] **Customer-facing auth realm** (2026-07-30): login, register, forgot/reset password
      (email link), and "remember me" — the prerequisite for bema's "Login as user" icon
      (still a disabled placeholder — the actual admin-mints-a-session-for-a-customer
      endpoint is separate, not-yet-built follow-up). Separate JWT secret/cookies from the
      bema realm (`CUSTOMER_AUTH_SECRET`, `gz_access_token`/`gz_refresh_token`), Server
      Actions (`src/app/[locale]/authenticate/actions.ts`) rather than `/api/*` Route
      Handlers since the public site has no client-side fetch/auth layer today. Same
      URLs/`<title>` as the legacy `authenticate/{login,register,forgot,reset}` pages (client
      request: SEO/backlink equity). "Remember me" = a longer-lived refresh cookie (30d vs.
      24h), not a separate token/column. Register auto-generates a `GZ`+number username
      (porting legacy's `getNewUsername()`) and skips email verification (accounts
      auto-confirm — no confirmation-email flow built, only the reset-link email). New
      `src/lib/email/sendEmail.ts` (`nodemailer`, logs to console if `SMTP_HOST` unset — no
      real SMTP credentials exist in this environment yet). Full writeup:
      `docs/decisions/0012-customer-auth.md`.
- [x] New shared `ui/Icon` component wraps the legacy sprite-icon system
      (`public/css/style.css`'s `i.icon.icon-*` classes) — `HeaderClient.tsx`'s icons ported
      to it as the first usage. Doesn't move the underlying CSS out of `style.css` yet (see
      the new AGENTS.md "Global CSS cleanup" rule — that's a page-by-page migration as more
      public pages get ported, not a one-shot rewrite).
- [x] **`/authenticate/login` pixel-parity pass** (2026-07-30, client-driven — flagged the
      page as not matching the live legacy layout at `usa.gzavnili.com/authenticate/login`):
      rebuilt to match 1:1 — page-heading banner + breadcrumbs (`.page-heading`/
      `.breadcrumbs`, already-global style.css rules), the `.container.loginpage` two-column
      body (`loginform`/`question`), the exact `.form-group` `a`-before-`label`-before-
      `input` markup order (load-bearing for the float-based layout), grid.css's `.row`/
      `.col-md-N` actually linked for the first time. Extracted into reusable components:
      `AuthLayout` (banner + two-column chrome), `QuestionPanel` (the "Have a question?"
      column, shared with the forgot-password page's identical block), `Greeting`
      (time-of-day heading/text). `public/css/loginpage.css` — previously an empty file in
      this checkout, with the real rules sitting unused in `loginpage.src.css` — retired
      entirely: its `.container.loginpage`-scoped rules moved into
      `AuthLayout.module.css` (component-owned, per AGENTS.md's "Global CSS cleanup" rule),
      the two unrelated leftover rules (`.selected-item-lang`/`.select2-dropdown`, used by
      the not-yet-ported `account/parcel-share` page) moved to `style.css`.
      **Greeting logic, corrected twice**: v1 guessed the visitor's timezone from the site's
      locale switcher (en→America/New_York, ge→Asia/Tbilisi) — wrong whenever someone
      browses a locale that doesn't match where they actually are. v2 switched to reading the
      visitor's own browser clock client-side (`Greeting` as a `'use client'` component) —
      more accurate per-visitor, but renders blank in the initial HTML and pops in after
      hydration, which the client flagged against a now-explicit AGENTS.md rule ("Public
      pages are server-rendered" — added this session specifically because of this bug).
      Final version (v3): server-rendered again, using the **server's own clock** — less
      accurate for a visitor far from the server's timezone (legacy's real IP-geolocation has
      no equivalent here), but real content in the first response, no flash, good for SEO.
      See `Greeting.tsx`'s comment and the new AGENTS.md rule.
      **Not yet done**: `register`/`forgot`/`reset` pages still use the earlier, simpler
      generic markup (not this pixel-matched chrome) — `AuthLayout`/`QuestionPanel` are
      ready to be reused for them when they get the same pass, not yet applied.
- [ ] **"Login as user"** (Customers list icon) is still a disabled placeholder — the
      customer auth realm above is the prerequisite and now exists, but the actual bema
      endpoint that mints a session for a given customer id isn't built yet. Scope as its own
      small follow-up now that the realm exists. (Asked the client 2026-07-30 whether to
      build it now; awaiting confirmation before starting.) Same gap now also placeholdered
      as "Customer account" on the parcels-list shipment-card header (`ParcelGroupCard`,
      2026-08-01) — one endpoint fixes both call sites.
- [ ] Customer-auth follow-ups (see `docs/decisions/0012-customer-auth.md`): no `/account`
      dashboard yet (login/register redirect to home instead); no email-verification-on-
      register step (accounts auto-confirm); no SMS password recovery or Facebook OAuth
      (both existed in legacy, excluded from this pass); `routes.testAccountLogin()`'s
      `?testaccount=1` demo-login link is unwired (shows the normal login form); real SMTP
      credentials still need to be set in production `.env` for reset-password emails to
      actually deliver (currently logged to console).
- [ ] **Global CSS cleanup** (see AGENTS.md's new rule): `public/css/style.css` should get
      progressively emptied out as each public page is touched — move component-specific
      rules into that component's CSS Module, shared rules into `src/app/globals.css`. Not
      started as a dedicated pass; do it incrementally per client instruction (2026-07-30),
      not as a one-shot rewrite.
- [ ] **Statement** (Customers list `$` icon) links to a real route
      (`/bema/statements/[id]`, `routes.bema.userStatement`) that's a placeholder page only
      ("Not implemented yet") — the statements module itself isn't built. See the rollout
      plan below.
- [ ] Real HTTP/browser-level verification of the bema UI — **done for the parcels list**
      (a local Postgres + dev server + headless Chromium run, see the parcels entry above),
      still outstanding for the screens built before it: login form, users list, create/edit
      forms, pricing rules. The same throwaway-Postgres setup makes this cheap now.
      (The `Bun.password` bug this item used to also carry is fixed — see the entry below.)
- [x] **Add Parcel** (2026-07-31, `docs/decisions/0017-bema-add-parcel.md`): the sidebar's
      "Add Parcel (new)" entry (label's "(new)" dropped, per client instruction) turned out to
      point at a genuinely different, second controller (`parcels-add.cfm` +
      `vwParcelsAdd.cfm`) from the single-parcel `nrc=1` add mode the first pass targeted —
      one customer, a batch of draft parcels (each its own receiver) assembled client-side and
      created together, with a shared per-group delivery-fee/minimum-charge calculation.
      Built: `batchPricing.ts` (the calculation, unit-tested — group fee tiers, minimum-charge
      stacking, Price Total override scaling), `parcelBatchAdd.ts`/`parcelBatchCustomer.ts`
      (service layer; extracted `parcelShared.ts`'s `upsertReceiver`/`upsertCustomer` out of
      the edit screen's `parcelUpdate.ts` so both screens share the receiver/customer-upsert
      logic), `POST /api/bema/parcels/batch` + `/quick-customer`, five new components
      (`ParcelAddCustomerSection`/`ParcelDraftFields`/`ParcelDraftModal`/`ParcelDraftTable`/
      `ParcelAddPaymentSection`/`ParcelAddPage`) plus two new shared UI primitives
      (`ui/RadioGroup`, `ui/Dialog`) and `Input`/ `ParcelReceiverSection` widened to be
      reusable here (ref-forwarding; narrower prop type). Also fixed while in the area: the
      customer-requiredness gap and the Regular→Personal store auto-toggle, both real
      behaviour on *both* add screens but only enforced client-side/half-ported on the edit
      screen before this pass — see `parcelSchema.ts`'s customer `.refine()`s and
      `ParcelDetailsSection`'s `handleServiceChange`.
      **Correction (same day, before anything shipped further):** the client asked "are you
      sure the pricing formula is 1:1?" — re-verifying by reading `MSSQLParcelDAO.cfc`'s
      actual `doOperation('paid')` (not just the `.cfm` call site) found that legacy's
      apparent two-payment-method split (`payAmount1`/`payAmount2`, proportional to each
      parcel's share) is dead code: the DAO ignores the passed amount and always invoices a
      parcel's full `debt`. The first version of this port had faithfully transcribed the
      *formula* but then used it for something legacy itself doesn't do (a proportional
      invoice). Fixed to reuse `applyPaidOperation` (full debt, matching the edit screen)
      and removed the now-provably-dead `paymentSplit()` function. The base price/group-fee/
      minimum-charge/Price-Total-override math itself (what actually computes `parcels.debt`)
      was independently re-verified line-by-line against the same POST handler and stands.
      See docs/decisions/0017's "traced into the DAO, confirmed dead" section.
      **Second correction, same day (client instruction: port legacy logic 1:1, bugs
      included, and record findings instead of silently deciding):** the BEMA-agent flat-rate
      override (`isAgent`/`agentPrice`, Regular-service parcels only) was initially skipped
      because `User.agentPrice` had been simplified to a bare `Boolean` in an earlier phase.
      Re-opened and built properly instead: schema migration
      (`20260731230000_agent_price_numeric`) restoring `agentPrice` to the real numeric rate
      legacy has, a "Agent Price" field added to `UserForm` (previously not wired into this
      project's user-edit screen at all), `resolveAgentFlatRate()` in `batchPricing.ts`
      (unit-tested), and the acting-session-based resolution in both `parcelBatchAdd.ts`
      (authoritative) and the client preview. The one `userPref == 'MR'` exclusion in legacy
      was resolved to a real username (`GZ2863114`) by cross-referencing
      `exclude-agents.cfm`'s comment, not skipped as unrecoverable. See docs/findings.md for
      the full trace. Also added AGENTS.md's "Legacy fidelity: bugs are ported, not fixed"
      rule and `docs/findings.md` itself as the process this correction follows going
      forward.
      Deliberately still not ported, each with its own reasoning in the decision doc: the
      tmp-table tracking-number reservation (drafts live in React state instead), the agent
      tracking-number *prefix* specifically (the pricing half is now ported; the cosmetic
      `CH`/`MR` tracking-number letters have no recoverable identifier for two of the three
      legacy GUIDs), `generateNewTracking()`'s ajax uniqueness loop for Duplicate, and
      per-draft inline error targeting on a batch-submit validation failure (flat message list
      instead) — that last one is a real, flagged gap for a large batch.
      **Still open, per client instruction ("everything as in legacy" for the split fields
      specifically):** the "Payment method 2"/two "Amount" fields stay in the UI exactly as
      legacy has them, confirmed inert (see docs/findings.md) — kept, not removed, since the
      client's instruction was fields-and-logic-as-legacy across the board.
- [ ] Parcel view, parcel print, the statements module's invoice/history popups, and the
      messages module's Send/Resend SMS. Also the edit form's "Invoice File" upload/preview
      row, which belongs to the files module. Same set now also pending at the shipment-card
      (group) header level, not just per-row — `ParcelGroupCard`'s "Generate Invoice"/"View
      Invoice" and "Print" buttons (2026-08-01) — one statements module and one print/scan
      module unblocks both the row- and group-level placeholders together, not two separate
      efforts.
- [x] Parcels list "Export Airway" (`export=2` → `airway.cfm`) link and endpoint
      (`src/app/api/bema/parcels/export-airway/route.ts`). No legacy source was recoverable;
      legacy's own version never populates any rows (confirmed against the running site) — the
      port reproduces that as a static two-line file (title + column headers), not a real
      per-parcel manifest. See docs/findings.md. Also fixed the filter bar (`ParcelFilters
      .module.css`) so all 12 fields (including "Debt") always stay on one line — legacy's
      search bar is a fixed-width, non-responsive row; `flex-wrap` was reflowing it onto a
      second line on an ordinary window width instead, so it's `nowrap` + horizontal scroll now.
- [x] "Add Parcel" (batch) visual-parity pass against the live legacy screen (no source exists
      to diff against, see above): `ParcelDraftTable`'s columns now match legacy's actual set/
      order (`First Name, Last Name, Cell Phone, Group, Weight, Value, Tracking #, Phone,
      Ubany, City, Street, Actions`, "Ubany"/"Phone" being `street2`/`phone2`, cross-checked
      against the CSV export's own column mapping), and the Customer/Payment sections lost
      their bordered-panel look (never a documented legacy behaviour, just this codebase's own
      incidental convention, hand-rolled twice) in favor of the new shared `ui/FormSection`.
      See `docs/decisions/0017-bema-add-parcel.md`'s "Visual-parity pass" section, which also
      flags — but doesn't resolve — that bema admin has no single documented layout convention
      across screens (field density, borders, grid vs. row); worth a real style pass before
      more screens are built.
- [x] Follow-up round on the same two screens, per explicit client pushback against unrequested
      additions: **removed the "Showing parcels you received…" banner and its `allReceivers=1`
      opt-out entirely** — both were an earlier pass's addition, not legacy behaviour (see the
      reverted entry in `docs/decisions/0015-bema-parcels-list.md`); the underlying silent
      scoping is still ported, `forcedReceivedBy` is gone from the list API response, and there
      is no longer any on-screen indication or opt-out, matching legacy exactly. Also dropped
      the invented "≠ amount" hint next to the Debt filter. Reverted the filter bar's `nowrap` +
      horizontal-scroll experiment (rejected as "недопустимо") back to `flex-wrap`, this time
      with meaningfully narrower `ui/Field` widths (`sm`/`md`, plus a new `xs` for the extra
      form's HH/MM selects) and the export links stacked vertically again instead of in a row,
      so the 12-field row and its two export links actually fit without scrolling. Fixed
      `ParcelExtraFilters`'s "Received By" stretching to the full row width (was `width="lg"`,
      which grows; now `"md"`, which doesn't). Fixed the Add Parcel customer-search
      autocomplete dropdown rendering at the full page width instead of the search field's own
      width (`position: relative` had ended up on the whole field row, not the search box).
      Widened `ui/Dialog`'s default max-width (960px → 1280px, its only consumer today is the
      per-parcel draft modal) to fit more fields per row like legacy's own wider modal. Added a
      `success` (green) `Button` variant and switched it in for "Add parcel and receiver" and
      the draft table's "Add Parcel" button, and changed `primary`'s blue and `secondary`'s
      style to Bootstrap 3's actual shades (`#337ab7`/white-with-border), since legacy's admin
      panel is Bootstrap 3 and operators are used to those exact colors, not this project's own
      blue.
- [x] Two more rounds on `ParcelFilters`/`ParcelExtraFilters`: (1) the extra search form's
      "Received By" select was showing "Any" while the implicit own-received scope was
      silently active — legacy's real mechanism sets `eadmin` into that same select's value, so
      the dropdown always shows the truth. Brought back a response field for this
      (`effectiveReceivedBy`, list route) purely to seed that select correctly — not a UI
      addition like the removed banner, since the select itself already existed and this only
      makes it accurate. (2) Restructured the main filter bar into two flex columns — fields
      (wrapping internally) on the left, GO + both export links stretching the full height of
      that block on the right — instead of GO/export just trailing whichever line the last
      field wrapped onto.
- [x] Corrected "Add Parcel" (batch) visual parity — the previous pass's guess (no bordered
      sections anywhere on this screen) was wrong; a follow-up screenshot showed legacy has two
      real bordered/backed panels here. Added the missing one at the top: `ParcelTripInfo`, the
      EXPRESS/REGULAR/CARGO ship-day/estimate/AVB block, backed by a new read-only
      `/api/bema/config/trip-info` route (Cargo fields always blank — no config columns for it,
      same as legacy). Rebuilt the bottom panel to match legacy's actual grouping: "Add Parcel"
      + both Payment method pairs + Price Total + notifications + the batch's own "Save" button
      (moved out of `ParcelAddPage`'s standalone row) all in one bordered panel, Save spanning
      its full height on the right. `ParcelDraftTable` no longer renders its own "Add Parcel"
      header — that button moved into the payment panel with everything else legacy groups it
      with. Flattened `ParcelAddCustomerSection` back to borderless (legacy really doesn't box
      it) but fixed its first field's label ("Search:" → "Customer:", matching legacy) and gave
      its Save button the same full-height-column treatment. Deleted `ui/FormSection` — it
      existed only for the incorrect all-flat guess and had zero callers once corrected. Also
      dropped `ParcelAddPage.module.css`'s `max-width: 1100px`, which had no legacy basis and
      made the page narrower than the rest of bema. See `docs/decisions/0017-bema-add-parcel.md`
      ("Visual-parity pass" / "Corrected layout").
- [x] Shared `ui/PageHeading` — every bema admin page's `<h1>` (Browse Parcels/Delivery
      Requests, Edit Parcel, Add Parcel, Customers/BEMA Users, Site Pages, Add/Edit Page,
      Add/Edit User, Site Settings, the statement stub) had drifted into two or three
      different font-size/weight/margin combinations across screens, plus a few bare unstyled
      `<h1>`s in thin `page.tsx` files. One component now owns the page-title look everywhere,
      with an optional trailing `meta` slot for the count/status line a few pages already had.
      Also gave `UserListPage`/`PageListPage`'s `.filterBar` a border — a white card on a
      white page background was invisible except for its padding once the page background was
      changed to white.
- [x] **Corrected the two parcels CSV exports against real legacy export samples**
      (`tmp/parcels_export.csv`, `tmp/airway_export.csv`, provided 2026-08-01) — both prior
      passes had guessed without a real reference and guessed wrong. "Export Parcels": legacy
      never CSV-quotes anything (a comma inside a plain field is stripped, not escaped), wraps
      exactly 7 specific columns in Excel's `="…"` formula syntax, has no BOM, and has two
      further undocumented quirks confirmed only from the sample — DEBT/PAID render zero
      differently (`0.` vs bare `0`), and 5 receiver/customer columns render a single space
      instead of a blank cell when empty. All reverted from this project's earlier "RFC 4180 +
      BOM" replacement back to legacy's actual formatting — see `docs/decisions/0015`'s
      now-removed table row and `docs/findings.md`. "Export Airway": the previous pass's guess
      that the whole document was a two-line stub was wrong — only the data-row table is
      empty; the manifest header above it (Airway Bill/Shipment Date/Shipper/Consignee/
      Airports/totals) is real and mostly static, now reproduced byte-for-byte including a
      trailing tab on two lines and a lone `\r\n` on the header row where every other line
      uses `\n`. The Airway Bill value itself (`config.regAwb`, falling back to `expAwb`)
      is still an inference, flagged as such in `docs/findings.md` — not confirmed against
      which service the export actually corresponds to.
- [ ] **Parcels: one thing worth confirming with the client** before it hardens into
      behaviour — the Debt filter is a *not-equal* match on uninvoiced parcels (the value `0`
      meaning "has a debt figure at all"), faithfully ported but unintuitive enough that it may
      not be what operators think it does.
      (The other item this bullet used to carry — legacy's `addressbook.Phone1/2/3` mapping
      onto `cellPhone`/`homePhone`/`privateNumber` — is confirmed correct: cross-checked
      directly against `vwReceiversUpdate.cfm`'s field labels this pass, "Phone (1)"/
      "Phone (2)"/"Private #", matching the mapping already in place.)
- [ ] Address-field requiredness (e.g. legacy's country-conditional State/PostalCode rule),
      and independent confirmation of `CustomerPricingRule`'s exact legacy semantics/column
      set (inferred from the live screen, not cross-checked against the legacy MSSQL
      schema directly) — both explicitly documented as simplifications/assumptions in
      `docs/decisions/0011-bema-admin.md`, not silently decided.
- [x] **Site Pages CMS** (2026-07-31, client-driven investigation first): verified which
      public URLs are genuinely CMS-backed vs. hardcoded before building anything — see
      `docs/decisions/0013-site-pages-cms.md` for the full investigation (corrected an
      initial "homepage is dead" hypothesis: it's actually still CMS-sourced, just via its
      own view wrapper). Built: Prisma `Page` model (`slug`+`locale` key, deliberately not
      modeling legacy's always-constant/always-empty `Type`/`Mobile`/`Groups` fields),
      public catch-all renderer (`src/app/[locale]/[...slug]/page.tsx`) with
      `generateStaticParams` + on-demand ISR (`revalidatePagePath()` called from the bema
      Page API routes on every create/update/delete — the direct equivalent of legacy's
      "write a fresh `{sha1(url)}.json` cache file on save," via Next's built-in
      revalidation instead of a hand-rolled file cache), bema CRUD
      (`src/components/admin/pages/`, `/bema/pages`) with a plain-HTML-textarea content
      field (no WYSIWYG — legacy uses TinyMCE, not pulled in), and a one-time import script
      (`bun run import:legacy-pages`) that's already been run against local dev — all 76
      real legacy pages imported and building as static pages (`bun run build` now
      pre-renders 101 pages, up from 24).
      **Not yet done**: the 5 pages whose legacy view substitutes a `{form...}` placeholder
      into the CMS content (contact/pick-up-service/help-to-shop/quotation/mailing-list)
      aren't rendered by the generic catch-all yet — each needs its own page + real form
      component, not just raw HTML injection.
- [x] **Site Pages follow-up fixes** (same day): `/parcel-service.html` 404'd — `proxy.ts`'s
      middleware matcher excluded *any* path with a dot (meant for static assets like
      `.css`/`.js`) which also excluded every `.html` CMS page; fixed to exclude by specific
      extension instead. `{CALCULATOR}` wasn't substituting — found a *second*,
      broader placeholder mechanism in legacy's shared layout (`views/layouts/new.html`,
      substitutes `{CALCULATOR}`/`{COURIERCALC_FORM}`/`{QUESTIONFORM}`/`{QUOTEFORM}`/
      `{HELPTOSHOP}`/`{VOLUMECAL}`/`{NEXTSEND}`/`{NEXTDEL}` into *any* page's content, not
      just the 5 hardcoded-controller pages) — wired up `{CALCULATOR}` via a `createPortal`
      (`src/components/PageContent/`, splitting the HTML string at the placeholder was
      rejected: real content has it inside a still-open parent div, so each half is
      unbalanced HTML and the browser mangles the surrounding box styling). Visual mismatch
      on `.whychooseus`/`.calc-block` traced to genuinely missing rules in
      `public/css/style.css` (confirmed via diffing a fresh pull of prod's stylesheet, not
      stale local content) — added `public/css/static.css`, a deliberately uncurated full
      copy of prod's CSS backing arbitrary CMS content, loaded only on the CMS catch-all
      route (not site-wide — was briefly wrong). Also cleaned ~180 pure `.header`/`.footer`
      rules out of `static.css` (already covered by ported components) and removed
      `public/css/grid.css` entirely — it was also briefly loaded site-wide by mistake
      (legacy only loads it on the login/register/forgot/reset pages); the ~6 actual classes
      needed (`.row`/`.col-md-5`/`.col-md-7`/`.col-sm-5`/`.col-sm-6`/`.col-sm-1`) are now
      plain local styles in `AuthLayout.module.css` instead of the full 1045-line file. See
      `docs/decisions/0013-site-pages-cms.md` for the full writeup and AGENTS.md's "Global
      CSS cleanup" section for the `static.css` exception.
- [x] **API service layer** (client-driven refactor): every component/page calling `fetch()`
      directly against `/api/bema/*` (10 files — `AuthProvider`, `IdleModal`, bema login
      page, `UserForm`/`UserListPage`/`PricingRulesSection` + their edit pages,
      `PageForm`/`PageListPage` + its edit page) now goes through
      `src/lib/api/http.ts` (shared `apiGet`/`apiPost`/`apiPatch`/`apiDelete` +
      `ApiError` + `extractErrorMessages()`) and one typed module per domain under
      `src/lib/api/bema/` (`auth.ts`/`users.ts`/`pricingRules.ts`/`pages.ts`). New
      AGENTS.md rule: "API calls go through a service layer."
- [x] **`/authenticate/register` pixel-parity pass** (client-driven — flagged as not
      matching legacy): rebuilt to match `views/authenticate/register.html` 1:1. The custom
      `.row`/`.col`/`.col-6` 12-unit grid and `.input-group`/`.accreg-btn-block`/`.agree`
      classes turned out to already be global (style.css), unlike the login page — no new
      CSS needed. Two real gaps found and fixed: the "I agree to Terms & Conditions and
      Privacy Policy" checkbox (`register_terms`, required — legacy has it, ours was
      missing entirely, now enforced in `registerSchema` as `z.literal('1')` since an
      unchecked checkbox is simply absent from FormData) and the notification-language
      radio buttons (English/ქართული — `language` was already accepted by the schema/
      action but had no form field to set it). Two-column layout restored: form column
      (`col-regform`) + a real FAQ sidebar column (`col-6.faq`, locale-dependent, 5 Q&A
      items transcribed from the legacy source, not invented) — added a `Register`
      messages namespace (en/ge) for all of this rather than hardcoding strings, matching
      the login page's i18n pattern.
      **Follow-up** (client-flagged): the page had turned into a pile of JSX detail instead
      of composition — extracted `RegisterLayout` (the `.container`/`.row`/`.col-regform`
      shell) and `RegisterFaq` (the right-column FAQ block) into their own components,
      leaving `register/page.tsx` as a 3-line `return`. Also fixed real missing styling
      found in the process: `.faq .faq-list .faq-item` (the accordion) only existed in
      `static.css` (CMS-only, not loaded on this page) — reused the homepage's existing
      `FaqAccordion` component instead (it already has this exact CSS properly extracted
      into its own module) rather than porting the rule a second time. New AGENTS.md rule:
      "Pages are thin."
- [x] **`Input` component now owns its own CSS** (client-flagged: `.input-group
      input[type=text]` still sat in `style.css`): split into `src/components/ui/Input.css`
      (the `input[type=...]`/`.datepicker`/`textarea` element styling — same already-decided
      pattern as `Select.css`, see docs/decisions/0002-select-library.md) and
      `src/app/globals.css` (the `.input-group` wrapper/label/radio-block layout, since
      that's used directly in JSX by many forms, not owned by `Input.tsx` itself). Page-
      specific modifiers still using these selectors (`.form-smaller`, `.tracking-page`,
      `search-parcels`, ...) left untouched in `style.css` — not this component's concern.
- [x] **`.faq h3`/`.faq .ralign` promoted to globals.css**: this styling had already been
      extracted into `Faq.module.css` for the home page's `Faq` component, scoping it away
      from the plain `className="faq"` string `RegisterFaq` uses — so the register page's
      FAQ headings/see-more-link rendered unstyled. Since the rule is now needed by two
      independent components, moved it to `globals.css` (per AGENTS.md's "Global CSS
      cleanup") instead of duplicating it a second time; `Faq.module.css` deleted (nothing
      left in it), `Faq.tsx` simplified to a plain `"faq"` classname.
- [x] **Register page "I agree to Terms" checkbox fixed**: legacy styles this via the iCheck
      jQuery plugin (`.icheckbox_minimal`, a sprite-image checkbox replacing a visually-
      hidden native one) — that plugin was never ported (no vendored legacy JS, see
      docs/decisions/0006), so the existing `style.css` rule referencing it was dead, and
      the real native checkbox rendered unstyled/misaligned (no `float:left` element to
      float, `span`'s leftover `margin-left: 25px` pushing the text out from under it).
      Replaced with a `label { display: flex }` layout plus a native
      `appearance: none` checkbox + hand-drawn `:checked` checkmark — no JS, matches the
      legacy look. Clicking the label already toggles the checkbox natively (real
      `<input>` wrapped in a real `<label>`); the only actual problem was the visual style.
- [x] **Site-wide announcement popup ported** (`docs/decisions/0014-site-popup.md`): legacy
      `views/layouts/new.html`'s `.message-popup`, driven by the `config` table's `ePopup`/
      `PopupMessageen`/`PopupMessagege` — client-reported bug confirmed and fixed: legacy shows
      the popup on `ePopup = 1` alone, even with a blank message; this port additionally
      requires a non-empty trimmed message for the visitor's locale
      (`src/components/SitePopup/`, wired into `src/app/[locale]/layout.tsx`). Reuses the
      existing `Modal` component instead of porting fancybox; `showpopup` dismissal cookie
      matches legacy's name/2h expiry. bema side: `/bema/settings` (`SiteSettingsForm`) +
      `GET`/`PATCH /api/bema/config`, scoped to only the popup fields — the rest of legacy's
      Site Settings mega-form (shipping dates/AWB/pricing) deferred to the parcels domain.
      `Config` Prisma model (previously unused) extended with `popupEnabled`/
      `popupMessageEn`/`popupMessageGe` (migration `20260731180000_add_site_popup`).
- [x] **`{QUOTEFORM}`/`{QUESTIONFORM}` CMS placeholders wired up** (client-reported:
      `cargo.html` was rendering the literal `{QUOTEFORM}` text instead of a form —
      docs/decisions/0013-site-pages-cms.md's "known gap"). Ported legacy's
      `quote_form.cfm`/`question_form.cfm` as `src/components/QuoteForm/`/
      `src/components/QuestionForm/`, backed by `submitQuoteForm`/`submitQuestionForm` Server
      Actions (`src/lib/actions/siteForms.ts`) that mail to `info@gzavnili.com` via the
      existing `sendEmail()` helper, same as legacy's `cfmail`. Generalized the single-purpose
      `CalculatorPortal.tsx` into a reusable `SlotPortal.tsx` now that 3 placeholders need the
      same "portal into an inert marker div" trick; `PageContent` now takes a `locale` prop.
      Affects `cargo.html` (both forms) and `parcel-service.html` (`{QUESTIONFORM}` only), en
      + ge. `{COURIERCALC_FORM}`/`{HELPTOSHOP}`/`{VOLUMECAL}` remain unported — each is a
      materially bigger dynamic calculator, not a simple contact form; deliberately deferred,
      client to prioritize next.
- [ ] Remaining bema modules per the rollout plan: products, orders, statements, content,
      reports, messages, config, coupons-adjacent Stores (structurally placeholder-recorded
      in the sidebar already). Coupons itself excluded per client instruction — never gets a
      working link. Parcels' *list* is done (above); its sibling screens are the open part —
      see the next item.
- [x] **Pricing Rules: fixed "Add Rule" reload bug + full legacy parity pass.** Root cause
      of the reported bug: `PricingRulesSection`'s own `<form>` was nested inside `UserForm`'s
      outer `<form>` — invalid HTML, so the browser dropped the inner one and "Add Rule"
      actually submitted the whole customer edit form. Fixed by closing the outer `<form>`
      before rendering `PricingRulesSection`. Investigating "is this feature actually done"
      surfaced several legacy behaviors the first pass hadn't ported — see
      `docs/findings.md`'s "Customer Pricing Rules" entry for full detail: soft delete
      ("Deactivate"/"Restore" instead of a real row delete — `isActive`/`deletedAt`/
      `deletedBy` added, migration `20260801012211_customer_pricing_rules_soft_delete_cargo`),
      overlap/conflict rejection on create and restore (`findOverlappingActiveRule`,
      `src/lib/services/pricingRuleOverlap.ts`, replacing legacy's DB trigger with an
      app-layer check since there's no direct-DB write path here), a missing `Cargo` service
      type, and a Status-column fidelity bug (legacy keys "Active"/"Inactive" off the flag
      alone, not date-range expiry — restored to match). Also built the second legacy screen
      the client asked to bring over alongside this fix: "Pricing Rules Administration"
      (`routes.bema.pricingRules()`, `PricingRulesAdminPage`, `GET /api/bema/pricing-rules`),
      a paginated/filterable cross-customer view, `BemaAdministrator`-gated (closest analog
      to legacy's `groupId 10`). `CustomerPicker` promoted from `admin/parcels/` to
      `components/ui/` (already had 3 callers; this is the 4th) with an added optional
      "Clear" affordance for filter-bar use.

## Not started

- Phase 0 (audit), Phase 3 (authorized zone), Phase 5 (mobile API), Phase 6 (cron), Phase 7
  (cutover) — see the rollout plan. Phase 1 is in progress (schema/triggers done, ETL/
  backfill not started). Phase 4 (bema admin) is in progress — see above.
