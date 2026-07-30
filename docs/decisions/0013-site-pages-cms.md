# 0013 — Site Pages CMS (bema "Site Pages")

## Investigation, before building anything

Client asked to verify which public URLs are actually served by the legacy CMS
(`bema/content/pages.cfm`/`page_edit.cfm`) before building a bema admin section for it —
specifically flagging a suspicion that some pages (e.g. the homepage) might be "dead",
superseded by hardcoded templates elsewhere in the legacy codebase.

**Mechanism** (`extensions/components/DAO/MSSQL/MSSQLPageDAO.cfc`): the MSSQL `pages` table
holds only metadata (Url, Type, Name, dates, `pages_groups` ACL) — the actual editable
content is never stored there. On save, it's serialized to
`{application.folders.pages}/{SHA-1(url)}.json` on disk (`http/include/pages/*.json` in this
checkout); reads go straight to that file, never the DB, specifically to avoid a per-request
DB hit. 76 real page files exist in this checkout's `http/include/pages/`.

**Routing** (`http/index.cfm`): every request resolves its CMS `Page` object *unconditionally*
before any route-specific logic runs (root `/` maps to `/index.html`, `session.language`
prefixes with `/ge/` for non-English). A handful of URLs then get a specific hardcoded
controller (via a `switch` on the first path segment): `tracking.html`, `authenticate/*`,
`account/*`, `store/*`, `checkout/*`, `api/*`, `pstep1-3.html`, `services-online[-store].html`,
`i`, `del.html`, `cbredirect.html` — genuinely **not** CMS content, no `pages` row exists for
most of them. Everything else falls to `Static.doGet()` → `views/static.html` →
`#page.getContent()#`, i.e. plain CMS-rendered content.

**Correcting the "dead homepage" hypothesis**: `Homepage.cfc.doGet()` (the `/` controller)
*also* reads `req.getArg('page')` — which the router already resolved to the `/index.html`
CMS row before dispatch — and renders `page.getContent()`, just through its own view
wrapper (`views/index.html`) instead of the generic one. **The homepage's CMS row is not
dead** — it's exactly what's rendering, just via a homepage-specific wrapper. This project's
homepage was independently reconstructed from this same cached JSON (see PROGRESS.md), so no
correction was needed there, but the general "some CMS rows might be superseded" concern was
worth checking rather than assuming.

**`contact.html`/`pick-up-service.html`/`help-to-shop.html`/`quotation.html`/
`mailing-list.html`** each have their own hardcoded controller+view (a request-handling form:
validation, email sending), but every one of those "hardcoded" views still calls
`page.getContent()` and substitutes a placeholder token (`{form}`, `{form_quotation}`, etc.)
with the dynamically-generated form markup. So the surrounding copy on these pages **is**
CMS-editable; only the form widget itself is code. Not modeled/ported in this pass (see
"Known gaps" below) — these five pages aren't rendered by the generic catch-all route.

**Conclusion**: of the 76 cached pages, effectively all are genuinely live CMS content.
`/parcel-service.html` specifically (the client's example) has no hardcoded case in the
router — confirmed served via the fully generic path.

## `public/css/static.css` — a second global stylesheet for CMS content

Rendering real imported content (e.g. `/parcel-service.html`) surfaced two more things:

1. **The `.whychooseus`/`.calc-block`/`.whyus-item` etc. rules were missing from
   `public/css/style.css` entirely** — not present at all, not just visually different.
   Client confirmed the local `http/include/pages/*.json` content dump is current/fresh, so
   this was a genuine style.css gap, not stale content. Diffing the full local `style.css`
   against a fresh pull of `https://usa.gzavnili.com/css/style.css?v=1.1` found ~300
   selector-level differences; most are **not** real gaps — they're rules already
   intentionally migrated into ported components' own CSS Modules (Header, Footer,
   HomeHero's slider, TrustUs, WhyChooseUs, the `ui/Icon` sprite rules, ...) per AGENTS.md's
   "Global CSS cleanup" rule, so a raw text diff flags them as "missing" when they're
   actually just relocated.
2. Cherry-picking only the "really missing, actually used by CMS content" subset via a
   selector/brace parser turned out fragile — nested `@media` blocks broke the naive
   parser's brace-matching, risking silently-corrupted CSS if trusted blindly.

Given both, and that Site Pages content can reference **any** of the site's dozens of
legacy page-specific classes (courier/cargo/prices/licenses/documents/faq/news/... — not a
small fixed set), the safer choice: `public/css/static.css` is a **complete, unedited copy**
of the current production `style.css`, loaded globally (`[locale]/layout.tsx`) *before*
`style.css` so `style.css`'s intentionally-curated/cleaned-up versions of shared classnames
(`.container`, `.btn`, ...) still win on ties. `static.css` itself is **not** curated or
deduplicated — it's a safety net for arbitrary CMS content, refreshed wholesale from prod
when needed, not migrated piecemeal like `style.css`. Re-sync by re-fetching
`https://usa.gzavnili.com/css/style.css?v=1.1` and overwriting the file outright.

## Layout-level placeholder substitution — a second mechanism, broader than the 5 form pages

`views/layouts/new.html` (the shared legacy page layout wrapping *every* rendered view, not
just specific controllers) does its own `{TOKEN}` substitution on `request.pageContent`
*after* the view renders — separate from, and broader than, the `{form}`/`{form_quotation}`
substitution inside the 5 hardcoded controllers (contact/pick-up-service/help-to-shop/
quotation/mailing-list) documented above. Confirmed tokens: `{CALCULATOR}` →
`homecals.cfm`, `{COURIERCALC_FORM}` → `couriercalc_form.cfm`, `{QUESTIONFORM}`/
`{QUOTEFORM}` → `question_form.cfm`/`quote_form.cfm`, `{HELPTOSHOP}` → `helpshop.cfm`,
`{VOLUMECAL}` → `volumecals.cfm`, plus two plain date tokens `{NEXTSEND}`/`{NEXTDEL}` (next
available ship/pickup dates, from `dayofweek(now())`) with no sub-template at all. Because
this runs at the layout level, **any** Site Pages content can contain these tokens, not just
the 5 special-routed pages — confirmed in real content: `/parcel-service.html` embeds
`{CALCULATOR}`.

**Implementation** (`src/components/PageContent/`): splitting the HTML string at the
placeholder and rendering each half through its own `dangerouslySetInnerHTML` was tried
first and rejected — real content has `{CALCULATOR}` sitting inside a still-open parent
(`<div class="calc-block-inner">...{CALCULATOR}</div>`), so each half is unbalanced HTML on
its own, and the browser auto-closes the dangling parent at each fragment's own boundary,
breaking the `.calc-block` box styling around the calculator. Instead: the whole content
renders as **one** `dangerouslySetInnerHTML` (keeping the original nesting intact), with
`{CALCULATOR}` swapped for an inert marker div (`data-calculator-slot`); a client component
(`CalculatorPortal.tsx`) then finds that marker after mount and `createPortal`s the real,
already-ported `Calculator` component into it. `{NEXTSEND}`/`{NEXTDEL}` are plain
server-computed text substitutions (no component needed).

**Only `{CALCULATOR}` is wired up** — it's the one confirmed in real content and the only
token with an existing React port. `{COURIERCALC_FORM}`/`{QUESTIONFORM}`/`{QUOTEFORM}`/
`{HELPTOSHOP}`/`{VOLUMECAL}` are left as literal, visible placeholder text if a page ever
contains them — a known, flagged gap, not a silent failure — until each of their source
sub-templates gets its own React port.

## Architecture

- **Prisma `Page` model** (`prisma/schema.prisma`) replaces the legacy DB-metadata +
  disk-JSON split with a single Postgres table — no reason to hand-roll a file cache when
  Next's own ISR gives the same "don't regenerate unless something changed" property.
  `slug` + `locale` is the natural key (e.g. `parcel-service.html` / `en`) instead of the
  legacy `Url` column, which encoded the locale as a `/ge/` URL prefix — next-intl's
  `[locale]` route segment already owns that, so a separate `locale` column plus a
  locale-free `slug` avoids storing the prefix twice.
- **Deliberately not modeled** (every one of the 76 real pages has the same constant/empty
  value — confirmed from the actual content dump, not guessed): `Type` (always `1`),
  `Mobile` (mobile-specific content override, always empty), `Groups` (front-end
  customer-group page visibility ACL, always empty — same "out of scope" call as customer
  discount tiers, docs/decisions/0011-bema-admin.md). The `Header` field *is* kept
  (`header`, ~half of pages have it set) for import fidelity even though the generic legacy
  template (`views/static.html`) never actually references `page.getHeader()` — its real
  display purpose wasn't established from the legacy code; flagged, not guessed at.
- **Public rendering**: `src/app/[locale]/[...slug]/page.tsx`, a catch-all that only
  receives requests Next.js couldn't match to a more specific literal route (so
  `/authenticate/login` etc. are unaffected). Looks up `(locale, slug)`, 404s via
  `notFound()` on a miss, renders `content` via `dangerouslySetInnerHTML` (admin-authored
  HTML — same trust boundary as the legacy WYSIWYG output, not user input),
  `generateMetadata` from `metaTitle`/`metaDescription`/`metaKeywords`.
  `/index.html` (any locale) redirects to that locale's home instead of rendering — the
  homepage is already a hand-built React port of this same content (PROGRESS.md), so this
  CMS row has nothing left to serve directly.
- **ISR instead of a file cache**: `generateStaticParams()` pre-renders every known page at
  build time; `revalidate = false` means a page is otherwise never regenerated on a timer.
  The bema Page create/update/delete API routes (`src/app/api/bema/pages/`) call
  `revalidatePagePath()` (`src/lib/services/revalidatePage.ts`) after every write — the
  direct equivalent of legacy's "write a fresh cache file on save," just via Next's
  built-in on-demand revalidation instead of a hand-rolled `fileWrite(...)`.
- **bema admin** (`src/components/admin/pages/`, `src/app/bema/(protected)/pages/`):
  list/create/edit/delete, same shared `Table`/`Pagination`/`CollapsibleSection` primitives
  as the Users screens. Content is a plain `<textarea>` of raw HTML, not a WYSIWYG editor —
  legacy uses TinyMCE; pulling in a rich-text editor dependency wasn't asked for and isn't
  needed for the CRUD to be functionally complete (matches bema's established
  "functionality over pixel/tooling parity" brief). **Delete is real here** (unlike Users,
  where legacy's own DAO has a no-op stub) — legacy's `MSSQLPageDAO.delete()` genuinely
  removes both the DB row and the cache file, so this CRUD does the same.
- **Data import**: `scripts/import-legacy-pages.ts` (`bun run import:legacy-pages`, guarded
  to local DBs like `db:migrate`) — one-time ETL reading every `http/include/pages/*.json`
  in the sibling legacy checkout, upserting into the new `pages` table by `(locale, slug)`.
  Already run once against local dev: all 76 pages imported.

## Known gaps / follow-ups

- **The 5 form-widget pages** (`contact.html`, `pick-up-service.html`, `help-to-shop.html`,
  `quotation.html`, `mailing-list.html`) aren't rendered by the generic catch-all — their
  content has a `{form...}` placeholder that needs real substitution with an actual React
  form component per page, not just raw HTML injection. Not built this pass; each needs its
  own small page + form component when it's prioritized.
- **No rich-text/WYSIWYG editor** in the bema Page form — raw HTML textarea only.
- **`header` field's real rendering purpose is unresolved** — present in the schema/import
  for fidelity, not displayed anywhere on the public page yet.
- **`/questions/ge` and `/shop/learn/ge`** are two anomalous legacy URLs that don't follow
  the `/ge/*.html` pattern (the `import-legacy-pages.ts` locale-detection only strips a
  literal `ge/` *prefix*) — imported as ordinary `en`-locale pages with slugs
  `questions/ge`/`shop/learn/ge` rather than being mis-detected as Georgian. Flagged in case
  they turn out to need different handling once actually visited/verified live.
- **`{COURIERCALC_FORM}`/`{QUESTIONFORM}`/`{QUOTEFORM}`/`{HELPTOSHOP}`/`{VOLUMECAL}`** —
  the other layout-level placeholder tokens (see the section above) render as literal text
  until each gets its own React port and a `PageContent` case, same pattern as
  `{CALCULATOR}`/`CalculatorPortal.tsx`.
- **`public/css/static.css`** is a wholesale, uncurated copy of prod's stylesheet (see the
  section above) — re-sync it by re-fetching `usa.gzavnili.com/css/style.css` outright when
  it's next known to be stale, don't hand-edit it piecemeal.
