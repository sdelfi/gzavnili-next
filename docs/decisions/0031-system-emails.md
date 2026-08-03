# 0031 — "System Emails"

## Scope

Ports `bema/config/emails.cfm` + `email_edit.cfm` + `views/config/vwSystemEmailForm.cfm` +
`views/config/vwEmailEditForm.cfm` — the "Basic Configuration" (sender/recipients/header/
footer, one singleton row) and "Specific Emails" (a fixed list of 10 per-template rows, each
with its own Sender/Recipients/Subject/Message) sections of the legacy admin email screen.

`Config` gained four fields (`emailSender`/`emailRecipients`/`emailHeader`/`emailFooter`) —
same singleton `config` row Site Settings and Payment Preferences already extend. A new
`EmailTemplate` model backs the 10 rows; legacy's `MSSQLEmailDAO.create()`/`delete()` are
empty stubs (the row set is fixed, never admin-creatable/removable), so the rows are seeded
once (`scripts/seed-email-templates.ts`, wired into `bun run db:seed`) rather than exposed via
a create/delete API — only `GET`/`PATCH` exist for a template, matching legacy's `read()`/
`update()`.

## Reachability of the 10 hardcoded `EmailId`s

`MSSQLEmailDAO.retrieveEmailConfig()` only ever loads templates whose `EmailId` is one of:
`Invoice`, `Help To Shop`, `Support Form`, `Pick Up Service`, `Quotation`, `Forgot Password`,
`Forgot Username`, `Register Email Confirmation`, `Account Change`, `Registration`. Before
building the screen, every real call site (`grep -rl getTemplateById`) was checked against
`http/index.cfm`'s front-controller switch to see which are genuinely live in production vs.
inherited e-commerce-framework dead code (`model.orders.Order`/`model.stores.Store`, no
equivalent domain in gzavnili-next):

| EmailId | Call site | Status |
|---|---|---|
| Invoice | `bema/statements/invoice-send.cfm`, `invoice-view.cfm` | Live — real admin "Send Invoice" action |
| Help To Shop | `controllers.Static.doHelpToShop` ← `/help-to-shop.html` (routed in `index.cfm`) | Live — real public form |
| Support Form | `controllers.Static.doSupport` ← `/contact.html` | Live — real public form |
| Pick Up Service | `controllers.Static.doPickUpService` ← `/pick-up-service.html` | Live — real public form |
| Quotation | `controllers.Static.doQuotation` ← `/quotation.html` | Live — real public form |
| Register Email Confirmation | `ApiNew2/register.cfm` (and `API`/`ApiNew`/`api2` sibling variants) | Live — real registration endpoint |
| Account Change | `controllers.Authenticate.doPasswordReset` ← `/authenticate/reset/` | Live — sent on password-reset completion |
| Registration | `MSSQLUserDAO.confirmAccount()` | Live — sent when a registered user confirms their email |
| Forgot Password | `controllers.Authenticate.doForgotLogin` ("password" case) | **Dead** — the `getTemplateById(...).filterLostPassword(...)` call is commented out, superseded by a hardcoded `EmailSimple` send |
| Forgot Username | `controllers.Authenticate.doForgotLogin` ("username" case) | **Dead** — same: commented out, superseded by hardcoded `EmailSimple` |

All 10 rows are still ported as editable admin data — legacy's own `emails.cfm` list shows
all 10 regardless of whether a live send path uses them, and `retrieveEmailConfig()` loads
all 10 unconditionally. The two dead ones are functionally inert (editing them changes
nothing a live legacy code path reads) but that's a property of the *legacy send code*, not
of this admin screen, which faithfully mirrors the legacy screen either way. See
`docs/findings.md`.

`Customer Invoice`/`Admin Invoice`/`Admin Cancellation Notice`/`Customer Cancellation
Notice`/`Customer Shipping Notice`/`Generated Users` — `getTemplateById` calls also exist for
these in `Checkout.cfc`/`Account.cfc`/`bema/orders/*.cfm`/`bema/import.cfm`, but none of
those ids are in the 10-id allow-list above, so `retrieveEmailConfig()` never loads a row for
them and `getTemplateById` always returns nothing there — not reachable through this screen
at all, nothing to port.

## `updateEmailConfig()`'s per-template bulk-update loop is commented out

`MSSQLEmailDAO.updateEmailConfig()` writes the `config` row (Basic Configuration) but its
per-template `UPDATE emails SET ...` loop is entirely `<!--- ... --->`-commented — the
"Specific Emails" table on `emails.cfm` has never been bulk-editable from that screen. Per-
template edits only ever happened through the separate `email_edit.cfm` screen, whose own
POST handler calls the DAO's real, uncommented `update()`. Reproduced the same way: `PATCH
/api/bema/config/emails` only ever writes the four Basic Configuration fields; per-template
edits are a separate `PATCH /api/bema/config/emails/templates/[id]`.

## Seed content: descriptions/tags are transcribed, not the real production data

`description`/`tags` for each of the 10 rows are derived from the legacy call sites and
`Template.cfc`'s `filterXxx()` methods (the literal `{tag}` strings each one substitutes) —
the actual `emails` table's production `Description`/`Tags`/`Subject`/`Message`/
`RecipientOverwrite` values aren't available to this port (no SQL dump). `subject`/`message`
are seeded blank (legacy has no default content for these anywhere in the CFML codebase —
they're pure admin-authored runtime data) and `recipientOverwrite` defaults `false` for all
10 rows. See `docs/findings.md`.

## What wasn't ported, and why

- **Create/delete a template row.** Legacy's own DAO `create()`/`delete()` are empty stubs —
  not reachable, nothing to port. The row set is fixed at exactly the 10 ids above.
- **The dead per-template inline edit UI in `vwSystemEmailForm.cfm`.** A large HTML-commented
  block shows what an inline Subject/Message editor on the list screen itself would have
  looked like, along with a hardcoded per-id "Insertable Value" tag reference table — never
  rendered, not reachable, nothing to port. The real per-template edit is the separate
  `email_edit.cfm` screen (`EmailTemplateEditForm` here), whose "Usable Tags" line is
  data-driven from the `Tags` column instead.
- **Rewiring existing send paths to consult this config.** This change ports the admin CRUD
  screen only. It does not change how `requestPasswordReset` (`src/lib/auth/
  customerPasswordReset.ts`) or any other already-shipped feature sends email — see
  `docs/findings.md` for the specific gap this leaves (`Account Change`).
