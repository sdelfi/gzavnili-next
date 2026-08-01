# 0021 — Messages / SMS list

## Investigation

Porting `bema/messages/messages.cfm` ("Messages") and `bema/messages/sms.cfm` ("SMS list")
together, since both read the same legacy `messages` table (`bema/messages/messages.cfc`),
split by the `bSMS` flag: `messages.cfm` shows `WHERE (bSMS IS NULL OR bSMS = 0)` rows (internal
admin↔customer messages), `sms.cfm` shows `WHERE bSMS = 1` rows (outbound SMS). Both require
`WEBSITE_ADMINISTRATOR,ADMINISTRATOR` — same gate used for Site Settings/Payment Preferences,
mapped to `BemaAdministrator` (this schema has no separate "website administrator" role).

Both screens are read-only browse lists in the legacy view (`sms.cfm`'s one edit link is
HTML-commented-out); `messages.cfm` additionally has an Active/Inactive status toggle and a
Delete action, both self-contained on that screen (a `?action=active|inactive|delete&id=...`
GET link, handled inline at the top of `messages.cfm` before the query runs).

**Scope**: only these two browse lists. Not built (see below): `message_add.cfm`/
`message_view.cfm` (compose/reply/view a message thread), `sms_add_batch.cfm`/
`sms_add_bulk.cfm`/`sms_add_user.cfm` (the bulk/scheduled SMS composers, one of which drives
the "Send SMS by Trip Date" nav item), and the `sms_queue`-table-backed outbound sender
(`messages/queue.cfc`, `cron/processSMSQueue.cfm`) those bulk composers write to — a
materially different, much larger feature (bulk-insert queue processing, a draining
scheduler) than a browse list, and out of scope for this change. The Sidebar's "Send SMS by
Trip Date"/"Send SMS Custom"/"Send Bulk SMS"/"Send message" placeholders are left unwired.
(`sms_add.cfm` — plain single-SMS "Send SMS" — was out of scope here too at the time, but has
since been built; see docs/decisions/0024-bema-send-sms.md.)

## Implementation

- `Message` model (new) — one `messages` table backing both screens, `isSms` boolean
  discriminating SMS rows from internal-message rows (legacy's nullable `bSMS`; modeled
  `NOT NULL DEFAULT false` here since this is a fresh table with no legacy data to migrate
  into it — eliminates the `IS NULL OR = 0` three-valued check without changing any
  observable behavior, the same "NOT NULL by design" pattern already used elsewhere in this
  schema, e.g. `User.active`). `messageTypeKey` reuses the pre-existing `MessageType` model
  (see its own doc comment) — `messages.cfc`'s `MessageTypes()` function queries the exact
  same legacy `MessageTypes` reference table already ported for the "Edit Customer"
  notification-preferences checkbox grid, not a second lookup table.
- `GET /api/bema/messages` (search: subject + body; filters: `chain`, `userId`), `PATCH
  /api/bema/messages/:id` (`{ active }`, the status toggle), `DELETE /api/bema/messages/:id`.
- `GET /api/bema/sms` (search: SMS body + phone + parcel tracking number; filter: `userId`) —
  no `PATCH`/`DELETE`, matching legacy's read-only view.
- `MessagesListPage`/`SmsListPage` (`src/components/admin/messages/`), reachable at
  `/bema/messages` (`routes.bema.messages()`) and `/bema/sms` (`routes.bema.smsList()`),
  wired to the pre-existing "Messages"/"SMS list" Sidebar placeholders. Modeled on
  `PageListPage` (Site Pages CMS list) for the Table/Pagination/search-on-Enter pattern —
  standard Prisma `skip`/`take` pagination, not a port of legacy's SQL Server `TOP`/`NOT IN`
  offset-emulation trick (a SQL-dialect mechanic, not a behavior to preserve).
- The Active/Inactive column is a clickable text link showing the *current* state that
  toggles it on click — reproducing legacy's own (mildly confusing) UX exactly, via
  `Button variant="link"`.

## What wasn't ported, and why

- **Reply/View, Send Message** (`message_view.cfm`/`message_add.cfm`): no target screen exists
  yet, so those links/actions aren't rendered — same "not fully ported, action omitted rather
  than dead-linked" treatment as the Money Collect report's Agents Name deep link
  (`docs/findings.md`). (Send SMS itself was in this same "no target screen" state at the time
  this change was made; since built — see docs/decisions/0024-bema-send-sms.md.)
- **`sms_queue` / bulk SMS sending** (`messages/queue.cfc`, `cron/processSMSQueue.cfm`): a
  separate outbound-queue table and draining scheduler, not the `messages` table this change
  covers at all. Still out of scope — the gateway integration itself (`messages.cfc`'s
  `sendsms()`, hitting Clickatell/smsoffice.ge) those bulk composers would also use is now
  built (`src/lib/services/smsGateway.ts`, docs/decisions/0024-bema-send-sms.md).
- Two dead-code findings from the legacy view/query are documented in `docs/findings.md`
  rather than reproduced: the "Message" column showing the message-type label instead of the
  body text, and four `url` params (`sort`/`dir`/`active`/`grp`) that are declared but never
  applied to the query.
