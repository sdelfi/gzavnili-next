# 0033 — "Send message"

## Scope

Ports `bema/messages/message_add.cfm` (compose) + `message_view.cfm` (view + reply) — the
last of the three MESSAGES-group Sidebar placeholders left unwired by
docs/decisions/0021-bema-messages.md ("Send SMS by Trip Date"/"Send SMS Custom" remain
unwired). `Message` already had `chain`/`replyToId`/`subject`/`subjectGe`/`body`/`bodyGe`
fields reserved for exactly this screen (see that model's own doc comment, written when the
browse list shipped) — this change is what those fields were modeled for.

Reused rather than rebuilt: `CustomerPicker`, the tracking-number lookup service
(`lookupParcelByTrackingNumber`/`lookupOnlineParcel`, extended additively with
`tripDate`/`trackingEstShip`/`trackingEstDelivery` for this screen's senddate/deliverydate/
servicetransit fields — no earlier caller needed them), `MAIL_TEMPLATES` +
`substituteTokens()` (already ported from `templates.cfm` for the cron notification engine,
docs/decisions/0027), and the `MessageType` seed data (14 rows, including `'other'` = legacy
numeric id 15, hardcoded for every reply).

## `messageFormatted`/`gemessageFormatted` are real columns — now confirmed, and modeled

An earlier finding ("Messages"/"SMS list" section) flagged `messageFormatted` as "not
confirmed to exist" — no DDL was available at the time. `message_add.cfm`'s own `INSERT
INTO Messages (..., message, gemessage, messageFormatted, gemessageFormatted) VALUES (...)`
confirms both columns are real: the message-type template with its `{tokens}` substituted,
plus the composer's own free-text body appended, computed once at write time. Modeled as
`Message.bodyFormatted`/`bodyFormattedGe`. `cron/sendMessages.cfm`'s own INSERT writes the
*same* value into `Message`/`GeMessage` and `MessageFormatted`/`GeMessageFormatted` (no
separate free-text portion for an auto-generated message) — `notificationEngine.ts`'s one
Mail-type `db.message.create()` call now sets all four fields accordingly.

`message_view.cfm` (`MessageViewPage`) is what actually displays `bodyFormatted`/
`bodyFormattedGe` — reproduced via `HTMLCodeFormat()`'s real behavior: the markup shown as
**literal, escaped text** (an operator sees the tags themselves, not rendered HTML), not
`dangerouslySetInnerHTML`. The compose form's own *live preview* is the opposite: legacy
renders it with jQuery's `.html()`, real HTML rendering — reproduced the same way
(`dangerouslySetInnerHTML` in `MessageComposeForm`). This is a genuine, deliberate asymmetry
between the two screens in legacy itself, not an inconsistency to unify.

## Reply keeps the original message's own `userId`/`sender` — a real quirk, ported as-is

`message_view.cfm`'s reply POST handler `INSERT`s the new row with `UserID = message.userid`
and `sender = message.sender` — the exact same values as the message being replied to, not
flipped to address the reply back at whoever sent the original. A reply to a message an admin
sent to a customer is, per legacy's own code, still addressed *to that same customer* and
still *from* whoever originally sent it — not from the admin doing the replying. Reproduced
exactly in `replyToMessage()` (`src/lib/services/messageCompose.ts`), not "fixed" into a
flipped-direction reply.

Also ported as-is: a reply performs **no template substitution at all** — the raw
`form.reply`/`form.gereply` text is written unchanged into all four body columns
(`body`/`bodyGe`/`bodyFormatted`/`bodyFormattedGe`), and a reply's `messageTypeKey` is always
the hardcoded `'other'` (legacy idmessagetype 15) regardless of the original message's type.

## Threading: compose self-chains, reply inherits

A freshly composed message always self-chains (`chain` = its own new id, written in a second
`UPDATE` after the `INSERT`, matching legacy's own two-statement shape rather than a value
known at insert time). A reply inherits the *original* message's `chain` (falling back to the
original's own id if that was blank) rather than starting a new chain — the two write paths
have genuinely different threading behavior, both reproduced as their own legacy source shows.

## Reply/View links unified into one action

`messages.cfm`'s actions column has both a "Reply" and a "View" link, but both point at the
exact same `message_view.cfm?id=...` URL (reply happens inline within that page's own form,
not a separate screen) — reproduced as a single "View" action in `MessagesListPage` rather
than two links to the same place. The "Reply to" column, previously plain text (no target
screen existed), now links to `message_view.cfm`'s equivalent.

## What wasn't ported, and why

- **The compose form's `#language` hidden field.** Legacy sets it from the picked customer's
  own language, but `previewTemplate()`'s own JS immediately overwrites the language-selected
  template lookup with a hardcoded `template-en` two lines later (`var template =
  data('template-' + language); var template = data('template-en');` — the first declaration
  is dead, shadowed by the second) — and both English and Georgian previews render
  unconditionally side-by-side regardless of `#language#`'s value either way. The field has no
  observable effect anywhere in this screen; not modeled.
- **`paidmessage`/`unpaidmessage` form fields.** Present as hidden inputs, populated from
  form fields that are themselves commented out of the visible form — always blank in
  practice. `{paidmessage}`/`{unpaidmessage}` tokens still get substituted (with an empty
  string, faithfully), just never with real content, matching legacy exactly.
