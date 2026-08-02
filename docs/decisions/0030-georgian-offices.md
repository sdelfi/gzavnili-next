# 0030 — "Georgian Offices"

## Scope

Ports `bema/config/offices.cfm` + `office_edit.cfm` + `views/config/vwOffices.cfm` +
`views/config/vwOfficeEditForm.cfm` — a plain CRUD admin screen for the delivery offices that
back the parcel form's "Delivery Office" picker (`DeliveryOffice`, already seeded with one
row, "Need delivery" — `docs/decisions/0015-bema-parcels-list.md`). Browse: search + Active/
Inactive/All filter + sortable columns + pagination. Edit form: City/Office Name/Office Name
(GE)/Letter, plus an Active checkbox. No delete action anywhere in legacy's own UI (the DAO
has a `delete()` method, but nothing links to it) — not added here either.

Modeled directly on the Site Pages CMS list/form pair
(`PageListPage`/`PageForm`, `docs/decisions/0013-site-pages-cms.md`) — same search+filter+
sort+paginate shape, same create/edit form shape.

## Schema: added `active`

`DeliveryOffice` had no `active` column — every prior consumer (the parcel form's picker
dropdown) only ever needed active offices implicitly. Added `active Boolean @default(true)`,
matching legacy's own default for a new record and its list screen's own default filter
(`Status: Active`, not "all").

## Two real, separate legacy bugs found in the edit form, both ported as-is

**Found — `searchPatterns` is wiped to blank on every single save.** The edit view
(`vwOfficeEditForm.cfm`) has a `searchPatterns` input, but the entire `<tr>` is commented out
— the field is never actually rendered. `office_edit.cfm` still `param`s
`form.searchPatterns default = ""`, and its POST handler unconditionally passes that (always
`""`) into `deliveryOffice.init(..., searchPatterns = form.searchPatterns)`, which both
`create()` and `update()` write straight to the column with no "only if provided" guard. Net
effect: **any edit to any office, ever, clears its `searchPatterns` value** — a real,
destructive-on-save bug, not a display omission.

**Ported as-is**: neither `DeliveryOfficeForm` nor `deliveryOfficeSchema` exposes a
`searchPatterns` field; both the create and update API routes write `searchPatterns: null`
unconditionally on every save, matching legacy's always-blank overwrite rather than leaving
whatever was there untouched.

**Found — the keyword search ANDs city and searchPatterns, so it can never match on city
alone.** `MSSQLDeliveryOfficeDAO.getOffices()`'s keyword loop appends, *for every space-
separated keyword*, both `AND city LIKE '%keyword%'` **and** `AND searchPatterns LIKE
'%keyword%'` — a conjunction, not the "search either column" an operator would expect from a
single "Search" box. Combined with the previous finding (`searchPatterns` is always blank),
this makes the keyword search field **permanently return zero rows for any query** in
practice — every real office has `searchPatterns` empty, so the second AND'd condition never
matches.

**Ported as-is**: the list route's keyword filter reproduces the same AND-per-keyword-across-
both-columns shape, not "fixed" into an OR that would make the search box actually useful.
This is a real, working-as-designed-on-paper-but-dead-in-practice feature, exactly as legacy
shipped it.

## List and edit screens require different roles — reproduced, not unified

`offices.cfm` (browse) gates `WEBSITE_ADMINISTRATOR,ADMINISTRATOR` → `BemaAdministrator` only.
`office_edit.cfm` (add/edit) gates the wider `WEBSITE_ADMINISTRATOR,ADMINISTRATOR,
AGENT_ADMINISTRATOR` → `BemaAdministrator`/`BemaAgent`. A `BemaAgent` can reach the edit form
directly by URL/id but can never browse the list to get there — the same "list is stricter
than edit" shape already found and reproduced for "Add Online Parcel" vs. the ajax lookup it
shares. `GET /api/bema/config/offices` (list) is gated `BemaAdministrator` only; `GET/POST/
PATCH .../offices[/:id]` (the edit form's read+write) are gated `BemaAdministrator`/
`BemaAgent`.

## What wasn't ported, and why

- **Delete.** No link to it anywhere in legacy's own UI, despite the DAO having a `delete()`
  method — not reachable, nothing to port.
- **`officeId`-based default sort.** Legacy's PK is a real auto-increment int, so its default
  sort (`officeId asc`) reads as roughly "insertion order." This schema's `id` is a UUID with
  no such meaning, and there's no `createdAt` column on this model to substitute — the list
  defaults to sorting by City instead, the first genuinely meaningful column, rather than
  adding a timestamp column solely to reproduce an incidental default.

See `docs/findings.md` for the two save-time bugs above.
