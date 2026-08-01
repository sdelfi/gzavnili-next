# 0025 — Send Bulk SMS

## Scope

Ports `bema/messages/sms_add_bulk.cfm` + `views/messages/vwSmsAddBulk.cfm` +
`include/js/sms-add-bulk.js` — the filter-driven bulk SMS composer: pick a parcel status
and/or customer-billing-country filter, choose whether to target the matching parcels'
customers and/or receivers, write a message, and enqueue. Also ports the `sms_queue` table
and `messages/queue.cfc`'s `bulkInsert()`/`count()`/`get()`/`clean()` this screen is built on
(a new `SmsQueueEntry` model — see `smsBulkQueue.ts`).

**Not ported: the queue-draining scheduler.** `cron/processSMSQueue.cfm` (bulk-invoking
`messages.cfc`'s `sendsms()` against smsoffice.ge/Clickatell, then deleting drained rows) is a
separate, materially different mechanism — a scheduled job, not a bema screen — already called
out as out of scope in docs/decisions/0021-bema-messages.md and docs/decisions/0024-bema-send-sms.md.
Per docs/decisions/0004-scheduled-jobs.md, cron migration is Phase 6 work, not started yet.
This screen genuinely queues real rows and shows real queue state (count, a preview, an empty
button) — it's just that nothing in this codebase drains the queue yet. Flagged again in
PROGRESS.md so it isn't lost.

Gated `WEBSITE_ADMINISTRATOR,CONTENT_ONLY,ADMINISTRATOR` → `BemaAdministrator`/
`BemaContentOnly` — narrower than "Send SMS"'s gate (no `AGENT_ADMINISTRATOR`/`BemaAgent`
here).

## Candidate query and phone resolution (`smsBulkQueue.ts`)

`findBulkSmsCandidates()` ports the composer's own parcel query: optionally filtered by the
*customer's billing* country (never the receiver's, even when only targeting receivers — the
`WHERE a1.Country = ...` clause has no receiver-country equivalent) and by status. Unlike
`getParcel.cfm`, this query has no `TrackingNum NOT LIKE 'dr-%'` exclusion — Delivery Request
placeholder parcels are eligible candidates here, reproduced as such (no filter added).

Status filtering reuses the trigger-maintained `Parcel.status` column (`BULK_SMS_STATUS_FILTER`)
rather than reproducing the screen's own inline `CASE` as a fourth one-off computation — the
same call already made for `getParcel.cfm` (docs/decisions/0022, `parcelOnlineLookup.ts`). One
real divergence and one dead dropdown option this introduces/preserves are in docs/findings.md
("Reusing `Parcel.status`..." and "The 'Paid' status filter...").

`resolveBulkSmsTargets()` ports the per-candidate customer/receiver resolution: a customer is
only included if `user.notifyViaSms` is true (legacy's `FindNoCase('sms', customerNotifications)`,
already modeled as that boolean when "Edit Customer" was built — no new finding here, this is
a direct reuse of existing data); a receiver has no such gate at all, always eligible if
`"receiver"` is selected. Both legs format the resolved phone via `smsGateway.ts`'s
`formatPhone()` (same function "Send SMS" uses) and dedup against two `Set`s shared across
*both* legs — a customer and receiver who share a phone number are only queued once, whichever
leg reaches them first in candidate order. The one real bug found in this resolution (a GE
receiver tagged `phoneType: "US"`) is in docs/findings.md.

## Queue preview ordering (`getSmsQueuePreview()`)

Legacy's own preview logic: with more than 10 rows queued, fetch the oldest 5
(`ORDER BY createdAt ASC`) and the newest 5 (`ORDER BY createdAt DESC`) as two separate
queries, then the view loops *each* batch from its last row back to its first before
rendering. Net effect: the oldest-5 batch displays newest-of-that-batch-first, oldest-overall-
last; the newest-5 batch displays oldest-of-that-batch-first, newest-overall-last — an
asymmetric "converge toward each extreme" order that reads like an artifact of reusing the
same reverse-loop markup for both batches rather than a deliberate design choice.
`getSmsQueuePreview()` reproduces it exactly (fetches both batches, reverses each before
returning) rather than picking a more intuitive order — see the function's own doc comment for
the full trace.

## What wasn't ported, and why

- **The `cron/processSMSQueue.cfm` draining scheduler** — see "Scope" above.
- **The commented-out country-list loop and "delivered" status option** in
  `vwSmsAddBulk.cfm` — both are HTML-commented-out in the legacy view (only GE/US country
  options and the without-"delivered" status list are live), so neither is reachable through
  the real UI. Not rendered here either.
- **`queue.cfc bulkInsert()`'s "(N already in queue)" discrepancy branch** — the underlying SQL
  is a plain unconditional multi-row `INSERT`, with no unique constraint on `sms_queue`
  visible anywhere in the accessible legacy source. `bulkInsertSmsQueue()`'s returned count
  should therefore always equal the number of rows attempted; the discrepancy message is
  computed in `SmsBulkPage` for structural parity but is not expected to ever actually differ
  in this schema (no uniqueness constraint was added — there's no legacy evidence one exists,
  and inventing one could reject a legitimate re-queue of the same number).
