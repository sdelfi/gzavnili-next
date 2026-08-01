# 0024 — Send SMS

## Scope

Ports `bema/messages/sms_add.cfm` + `views/messages/vwSmsAdd.cfm` +
`include/js/sms-add.js` — the single-SMS composer reachable from the Sidebar's "Send SMS"
item and from each parcel row's own "Send SMS" action (`?trackingnum=...`). Sends
synchronously, inline in the request — this screen never touches `sms_queue`/`queue.cfc` or
`cron/processSMSQueue.cfm` at all (that queue-and-scheduler mechanism belongs to the bulk
composers, `sms_add_bulk.cfm`/`sms_add_batch.cfm`, still out of scope; see
docs/decisions/0021-bema-messages.md's own "not ported" list).

Gated `WEBSITE_ADMINISTRATOR,CONTENT_ONLY,ADMINISTRATOR,AGENT_ADMINISTRATOR` — wider than
every other bema screen ported so far, and the first real use found for the `CONTENT_ONLY`
legacy role (see below and docs/findings.md).

## `CONTENT_ONLY` gets added back to `AdminRole`

`prisma/schema.prisma`'s `AdminRole` enum doc comment already flagged this possibility:
`CONTENT_ONLY`/`STANDARD`/`SALES_MANAGER` were dropped during the initial schema pass because
no ported screen's gate needed them, with an explicit "add them back explicitly if a real use
is found." This screen is that real use for `CONTENT_ONLY`. Added as `BemaContentOnly`
(migration `20260801201051_add_bema_content_only_role`, an `ALTER TYPE ... ADD VALUE`) and:

- This screen's own `POST /api/bema/sms` gate.
- The shared tracking-number lookup (`GET /api/bema/parcels/online-lookup`) — now used by
  three screens, gated to the union of what they each allow.
- `GET /api/bema/receivers/:id` — this screen reads a receiver's name/phone through it to
  autofill the recipient; legacy's own `bema/ajax/receiver.cfm` has no role gate of its own at
  all, so this is additive on top of the existing `RECEIVER_ROLES`, not a replacement.
- `UserForm`'s role dropdown, so an admin can actually be assigned the new role.

`STANDARD`/`SALES_MANAGER` are still unobserved and still not carried forward.

## The tracking-number lookup is generalized to a third caller (`cut=0`, exact match)

`lookupParcelByTrackingNumber()` (docs/decisions/0022, 0023) already served "Add Online
Parcel" and "Change Parcel status" with different `cutLength`/`withTrackingNum2` params. This
screen calls `getParcel.cfm?cut=0&trackingnum=...` — an *exact* `TrackingNum` match, no
right-cut/fuzzy fallback. Legacy's own `cut=0` branch technically runs its "fallback" query a
second time when the first finds nothing, but for `cut=0` both queries are the literal same
exact-equality condition — no second distinct query exists to reproduce, so the port's
`cut: 'exact'` mode is genuinely just the one query. See docs/findings.md for two real bugs
found in this screen's specific use of the lookup (the `#parcelid` field, and the collapsed
"not found"/"no receiver" alert).

## What actually gets saved — far less than the screen implies

The screen visually looks like it's linking each sent SMS to a specific parcel and customer:
you look up a tracking number, it resolves and displays the receiver's name, you send. In
practice, **none of that ends up in the database.** Three independent legacy bugs combine to
this effect — full detail and evidence in docs/findings.md:

1. The lookup's `#parcelid` field is never actually populated (a JSON key-casing mismatch in
   `sms-add.js`: `data.parcelId` against a response whose keys are all uppercase).
2. `#userid` is a hidden field nothing in the file ever sets, on any reachable path.
3. The `sender` column — written as `form.phone1` here, not an admin id — doesn't fit this
   schema's `Message.senderId` `Uuid` FK at all, and legacy's own SMS/Messages browse views
   never display it either way.

Ported as observed: `POST /api/bema/sms` creates the `Message` row with `userId: null`,
`parcelId: null`, `senderId: null` unconditionally — this isn't a stopgap pending a future fix,
it's what the real flow actually does end-to-end (verified locally). The lookup still has real
value for the operator (confirming the right recipient before sending, filling in the phone
number), it just never gets recorded.

## `formatPhone`/`sendSms` (`messages.cfc`'s `formatphone()`/`sendsms()`)

Ported to `src/lib/services/smsGateway.ts`. `sms_add.cfm` always calls in with type `"GE"`
hardcoded (the commented-out US-detection branch, `address2.getCountry() eq 'GE'`, is dead),
so only the GE (smsoffice.ge) gateway is reachable from this screen — the US (Clickatell)
branch is ported alongside it anyway since `sendSms()`'s own `verifiedType` re-derivation
(a `995`/`+995` phone prefix always forces GE, regardless of the `type` argument) is shared,
caller-agnostic logic, not specific to this one screen.

Legacy hardcodes both gateways' API keys in `messages.cfc`'s source. The port reads them from
`SMS_GATEWAY_GE_KEY`/`SMS_GATEWAY_US_KEY`/`SMS_GATEWAY_US_FROM` instead — a deliberate
deviation (secrets don't belong in source control), not a behavior change to the request
itself. No credentials exist in this environment, so an unconfigured gateway logs instead of
sending, the same "degrade to logging" precedent `src/lib/email/sendEmail.ts` already
established for SMTP. Verified locally end-to-end with the gateway unconfigured: the "SMS #N
successfully sent" flash and the `Messages` row both happen exactly as they would with a real
gateway, matching legacy's own total lack of error handling around the HTTP call.

## Submission is gated on the receiver-name field, not on "has a lookup succeeded"

Legacy's only `required` input is the readonly receiver-name field (`#name`) — everything else
(`#message`, and the hidden fields) has no client-side requirement. Clicking the locked
tracking-number field to edit it again clears `#userid`/`#parcelid` (already always blank
anyway) but **not** `#name`/`#phone1` — so an operator can unlock, type a different tracking
number, and submit *without* re-running the lookup, sending to the previous receiver's phone
under a new (never-submitted-anyway) tracking number.

**Ported as-is**: `SmsAddPage`'s submit button is disabled on `!name.trim()`, not on a
`locked` flag — unlocking the tracking-number field never clears `name`/`phone1` state.

## What wasn't ported, and why

- **`url.phone1`/`url.parcelid`/`url.receiverid`** — declared `cfparam`s with no
  corresponding query-string producer anywhere in the codebase (every real link only ever
  passes `?trackingnum=...`) and never read again after being declared. Dead.
- **`form.trackingnum`/`form.name`/`form.receiverid`** — form fields that round-trip through
  the server on a failed POST purely to re-render themselves (GET-time echo), never read by
  any actual logic. This app's client-side form state already persists across a failed submit
  without a server round-trip, so there's nothing to reproduce here.
- **`session.notcheck`-style session state** — this screen has none; not applicable.
