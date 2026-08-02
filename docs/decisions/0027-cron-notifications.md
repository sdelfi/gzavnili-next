# 0027 — Automated customer-notification cron cluster

## Scope

Deferred from docs/decisions/0026-cron-phase6.md as "a materially larger, separate feature, not
a mechanical port." This pass covers the four legacy files: `cron/sendMessages.cfm` (609 lines,
the real event-driven notification engine), `cron/sendOnholdSMS.cfm`, `cron/sendCustomerSMS.cfm`,
and `cron/sendLinoli.cfm`. The three "sibling" files are genuinely independent jobs, not earlier
or superseded drafts of `sendMessages.cfm` — each reads/writes its own dedicated one-time flag on
`Parcel` (`bSentOnHold`, `bCustomerSms`) and never touches the `operations` table `sendMessages.cfm`
drives, and `sendLinoli.cfm` isn't a notification job at all (see below). All four are ported.

## `sendMessages.cfm` → `src/lib/notifications/notificationEngine.ts`

**Queue-worthy** (docs/decisions/0004-scheduled-jobs.md), not a simple sweep — like the
`sms_queue` drain, it makes outbound SMS-gateway HTTP calls per run and writes `Message` rows,
so it's a BullMQ repeatable job (`src/lib/queue/notificationEngineWorker.ts`, registered in
`scripts/worker.ts`), every 600 seconds, matching legacy's own commented-out `cfschedule`
interval.

### The algorithm, in order

Each run does up to `OPERATIONS_COUNT` (30) units of work, one per iteration, stopping early
once a unit finds nothing to process (legacy just burns through the rest of its loop doing
nothing — `Sleep(1500)` included — which has no observable effect worth reproducing):

1. **Pick.** The single oldest `Operation` row not yet fully notified (`sentNotification IS
   NULL OR sentSms IS NULL`), within a 2-week-or-`OPERATIONS_DATESTART` window (whichever is
   later), excluding `operation = 'estdelivery'`.
2. **Supersede.** If that same parcel has a *later* still-unnotified operation, mark everything
   in between as handled (both flags, no message ever composed for them) and switch to
   processing the latest one instead. This collapses a burst of operations on one parcel down to
   whichever is newest.
3. **Siblings.** Find sibling parcels in the same sender+trip+group batch with the *same*
   operation name, still unnotified — these get the same bookkeeping applied alongside the main
   operation (not separately composed for). Legacy compares `TRIPDATE`/`GROUPID` by plain SQL
   equality, which never matches a NULL; a parcel with no group or trip date is treated as
   having no siblings rather than matching other null rows.
4. **Suppress or notify.** If no `MessageType` maps to this operation name, or it's the
   "ready to pickup" type for a Region/Delivery-service parcel (case-sensitive `R`/`D`
   tracking-number-prefix check — see docs/findings.md), mark handled with no message at all.
   Otherwise: an independent **Mail leg** (gated on `sentNotification`, `User.notifyViaMail` +
   `notificationMessageTypes` membership) and **SMS leg** (gated on `sentSms`, with its own
   receiver/customer eligibility and a *case-insensitive* block-list — a deliberately different
   case sensitivity from step 4's own check).
5. **Flush.** Every GE-bound SMS queued during the run (both receiver- and customer-bound) is
   deduped by exact message text and flushed as one gateway call per unique text, only once the
   whole run finishes. A US-bound customer SMS is sent immediately instead — see
   docs/findings.md for why these aren't the same mechanism.

### Schema changes

- `Operation` (already modeled in 0026) gained no new fields this pass — the bookkeeping columns
  (`sentNotification`/`sentSms`/`notifyResultCode`/`sentAt`/`receiverIdAtSend`/
  `customerPhone{Raw,Formatted}`/`receiverPhone{Raw,Formatted}`) were added as a prerequisite in
  a prior change within this same work.
- `Message` gained `subjectGe`/`bodyGe`; `MessageType` gained `labelGe`. Legacy's
  `MessageTypes`/`sendMessages.cfm` store a Georgian variant of subject/body alongside the
  English one, and `views/account/messages.html` (the customer inbox, not yet ported) picks
  whichever matches the *viewer's current session language* at read time — not a fixed
  per-account language — so a single-language column would lose real functionality once that
  screen exists. `labelGe` has no accessible source data yet (see docs/findings.md) and falls
  back to the English `label`.
- **Retroactive fix**: `runParcelOperation()` (docs/decisions/0023-parcels-change-status.md)
  now also writes `Operation` rows in every branch (`applyPaidOperation`/`applyUnpaidOperation`/
  the main status-column branch). An earlier pass had decided the `operations` table was
  write-only in this schema and skipped writing it — wrong, once `sendMessages.cfm`'s own read
  side (this pass) exists as a real consumer.

### Templates

`bema/messages/templates.cfm`/`templates_sms.cfm` ported verbatim into
`src/lib/notifications/mailTemplates.ts`/`smsTemplates.ts`, keyed by this schema's
`MessageType.key` (cross-referenced against `sendMessages.cfm`'s own trailing operation→type
comment, with two disagreements flagged in the seed script). `substituteTokens()`
(`templateTokens.ts`) reproduces legacy's `Replace(x, "{token}", value, 'all')` — a literal
global string replace, not a regex — token by token. Deliberately not substituted: `{attachment}`
(no photo-upload mechanism ported), `{receiverid}` (present in no template's actual content).

## `sendOnholdSMS.cfm` → `scripts/cron/onhold-sms.ts` / `src/lib/parcels/onholdSmsSweep.ts`

Simple sweep, one-time per parcel via `Parcel.bSentOnHold`. Queries every still-on-hold,
not-yet-messaged parcel; skips messaging (but still marks handled) for one already
`shipped`/`delivered`, using a status derived purely from tracking-milestone columns — legacy's
own local `CASE`, not this schema's shared `Parcel.status` column, which would read "on_hold"
for every row this job's own filter selects. GE numbers are gathered into one phone-deduped
batch and sent as a single gateway call; US numbers (both English- and Georgian-message
variants, split by `User.language`) go through the same exact-text dedup-and-batch helper the
notification engine uses (`src/lib/services/smsBatch.ts`, extracted here since this is its
second real caller). The final `bSentOnHold` update runs in a `finally` block, matching
legacy's own identical `UPDATE` appearing both on success and inside its `cfcatch`.

## `sendCustomerSMS.cfm` → `scripts/cron/customer-received-sms.ts` / `src/lib/parcels/customerReceivedSmsSweep.ts`

One-time per sender+trip-group via `Parcel.bCustomerSms`. **Not a batch** — see
docs/findings.md: the real invocation processes exactly one eligible parcel per run,
relying on its own 120-second interval to drain the backlog. GE-billed customers get a
`Message` row but, per a real legacy bug (commented-out `sendsms` call), no actual SMS —
reproduced as observed. US-billed customers get an immediate `sendSms(..., 'US')` call.

## `sendLinoli.cfm` → `scripts/cron/linoli-report.ts` / `src/lib/parcels/linoliReport.ts`

Not a notification job — a daily CSV manifest of the "Linoli" placeholder shipper's
(`GZ20001`) not-yet-delivered parcels received today, emailed as an attachment to a business
partner (`info@linoni.ge`). No source `cfschedule` interval exists for this file at all (it's
absent from every other job's commented-out block); scheduled once daily, matching the report's
own "today's received parcels" scope. `sendEmail()` (`src/lib/email/sendEmail.ts`) gained
`cc`/`bcc`/`attachments`/`text`/`from` options to support this. The CSV's DEBT/PAID
asymmetric-zero-formatting rule is the exact one already found and ported for the "Export
Parcels" CSV (docs/decisions/0015-bema-parcels-list.md) — extracted into shared
`src/lib/services/csvCellFormat.ts` rather than re-implemented, and the "Export Parcels" route
updated to import from there instead of keeping its own private copy. The `additional_*`
DAO-join fields (blank-name fallback, `GZ20001` username rewrite) are the same known gap already
recorded for that same CSV export — not re-ported here either; see docs/findings.md.

## What wasn't ported

- `sendCustomerSMS.cfm`'s `?parcelid=...`/`url.fromParcelsAdd` debug/manual-test invocation
  path — never reachable from the real scheduled URL hit. See docs/findings.md.
- `MessageTypes.gename` real translations — no accessible source data; `MessageType.labelGe`
  exists and is wired up, just unpopulated until legacy data is imported.
- `sender_userid`'s real account identity — no discoverable cross-reference in the accessible
  legacy source; Mail-type `Message.senderId` is always `null`, matching the precedent already
  set for SMS-type `sender` values in docs/decisions/0024-bema-send-sms.md.
