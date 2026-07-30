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
