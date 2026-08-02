# 0026 — Phase 6 cron migration: foundation + first three jobs

## Scope

Phase 6 per docs/migrations/06-phased-rollout-plan.md: replacing `http/cron/*.cfm` (14 files)
with scheduled jobs/workers per docs/decisions/0004-scheduled-jobs.md. This pass:

- **Infrastructure**: `docker-compose.yml`'s `redis` service uncommented; `bullmq`/`ioredis`
  added; `JobRun` model (`job_runs` — observability, per 0004's "log every run somewhere
  queryable... don't repeat [legacy's silent failures]"); a minimal `Operation` model
  (`operations`) for the one write this pass needs; `src/lib/jobs/runJob.ts` (wraps a job body
  with `JobRun` start/success/failure bookkeeping, every job below uses it);
  `src/lib/queue/connection.ts` (shared BullMQ Redis connection).
- **Simple sweeps** (`scripts/cron/*.ts`, meant for a VDS crontab entry, one process per run):
  `onhold.ts` (`cron/onhold.cfm`), `change-parcel-status.ts` (`cron/changeParcelStatus.cfm`).
- **Queue-worthy** (BullMQ, `scripts/worker.ts` as the long-running process, `systemd`/`pm2`
  per 0004): the `sms_queue` drain (`cron/processSMSQueue.cfm`) — the job that actually sends
  what "Send Bulk SMS" enqueues (docs/decisions/0025-bema-send-bulk-sms.md), a 180-second
  repeatable job matching legacy's own (commented-out) `cfschedule` interval.

**Explicitly deferred, with reasons** — see "What wasn't ported" below: `getCoupons.cfm`/
`getStores.cfm` (already out of scope, coupons module), `cleanTmpParcels.cfm` (nothing to
clean — see docs/findings.md), `updatePcode.cfm` (missing schema — see docs/findings.md), and
the automated customer-notification cron cluster (`sendMessages.cfm`/`sendCustomerSMS.cfm`/
`sendOnholdSMS.cfm`/`sendLinoli.cfm`) — a materially larger, separate feature, not a
mechanical port; scoped as its own future pass, not started here.

## `onhold.cfm` → `scripts/cron/onhold.ts`

14 sequential statements, ported in the same order, inside one transaction (legacy runs each
`<cfquery>` uncommitted/standalone — wrapping them together is a reliability improvement, not
a business-logic change: either the whole sweep's effects land together or none do, rather
than a mid-run failure leaving some parcels touched and others not). Two SQL-Server-only
`LEN(x) > 1`/`LEN(x) > 0` conditions (steps 7's Store/Contents checks) have no direct Prisma
equivalent — those two statements fetch a broader candidate set via Prisma, filter precisely
in JS (`store.length > 1`, etc.), then bulk-update by the resulting id list. Two statements
compute a *per-row* value (step 12's `TrackingDeliveredSigned = TrackingSendRegion + 7d`, step
13's `TrackingEstDelivery + 1d`) rather than a constant — those loop and update per row,
matching what a single SQL `UPDATE ... SET x = y + interval` would compute, just evaluated
client-side.

The hardcoded MSSQL GUID `581ACE56-EEE2-E30F-50E6B1F3359ECAAE` — legacy's on-hold exemption
for a specific shipper — resolves to `GZ20001` ("Linoli"), confirmed by a comment in
`parcels-online-add-2.cfm` ("`GZ20001 - linoli ... live 581ACE56-...`") that ties the exact
same GUID to the exact same placeholder account `scripts/seed-parcel-shippers.ts` already
seeds (docs/decisions/0022-parcels-online-add.md) — resolved by username lookup, same
precedent, not a new hardcoded id.

Verified locally against real Postgres: the on-hold rule firing on a bare-minimum parcel, and
the Delivery Request paid-flag propagating to both the `DR-` row and its stripped-prefix
sibling.

## `changeParcelStatus.cfm` → `scripts/cron/change-parcel-status.ts`

Straightforward: parcels whose `TripDate` was yesterday, created after the cutoff, currently
`Received` → stamp `TrackingShipped` with that same trip date (copied, not "now") and log an
`Operation` row. Reuses `Parcel.status === 'Received'` instead of legacy's own inline CASE —
one acknowledged divergence, see docs/findings.md. Verified locally: a `Received` parcel with
yesterday's trip date gets `TrackingShipped` stamped, the trigger recomputes `status` to
`Shipped`, and the `Operation` row lands with the trip date as its `operationTime`.

## `processSMSQueue.cfm` → BullMQ (`src/lib/services/smsQueueDrain.ts` + `src/lib/queue/smsQueueWorker.ts`)

Drains up to 50 oldest-queued `sms_queue` rows per run. Every row gets a `Message` row
regardless of send outcome (no `userId`/`parcelId`/`senderId` — same as "Send SMS"'s own
insert, docs/decisions/0024-bema-send-sms.md). `US`-tagged rows send individually, inline,
as encountered; `GE`-tagged rows are *not* sent inline — they're grouped by exact-matching
message text across the whole batch (comma-joining phones per unique text) and only sent,
one gateway call per group, after every row in the batch has been classified — reproduced by
`groupGeRowsByText()`, tested in isolation. Rows are only deleted (by id, not a blanket
`DELETE`) after the whole batch has been processed, so anything enqueued mid-run survives
untouched into the next run.

Chosen for BullMQ (not a plain crontab script) because legacy's own interval was 180 seconds
— exactly 0004's "needs retries/backpressure" category, not a daily/simple sweep. The
repeatable job is registered via `queue.upsertJobScheduler()`; `scripts/worker.ts` is the
long-running process (`systemd`/`pm2` per 0004) that both schedules it and runs the `Worker`
consuming it. Verified locally end-to-end: `docker-compose.yml`'s `redis` service (started
natively for this session, `redis-server`), a seeded `sms_queue` with one `US` row and two
same-text `GE` rows, `bun run scripts/worker.ts`, a manually-enqueued trigger job — confirmed
one grouped GE gateway call (both phones comma-joined) plus one individual US call, four
`Message` rows (one per original queue row), the queue cleared, and a `JobRun` row recording
the batch.

## What wasn't ported, and why

- **`getCoupons.cfm`/`getStores.cfm`**: the coupons module, explicitly excluded from this
  migration's scope by the client (docs/migrations/01-current-state-audit.md). Unchanged by
  this pass.
- **`cleanTmpParcels.cfm`**: its producing feature (`bema/ajax/tmpTracking.cfm`, a
  same-tracking-number concurrent-entry warning for the batch "Add Parcel" screen) was never
  built — nothing writes to an equivalent table, so there's nothing to clean. See
  docs/findings.md. Revisit if/when that collision-detection feature gets built.
- **`updatePcode.cfm`**: reads schema this migration doesn't have (`pcode2`, `payments.
  transactionid`, `invoices.TransactionId`) — a real modeling decision, not a mechanical port.
  See docs/findings.md.
- **`sendMessages.cfm`/`sendCustomerSMS.cfm`/`sendOnholdSMS.cfm`/`sendLinoli.cfm`** — the
  automated customer-notification engine. `sendMessages.cfm` alone is 609 lines: an
  event-driven system reading the `operations` table (only minimally modeled here — this
  pass's `Operation` covers the one write `changeParcelStatus.cfm` needs, not the
  `bSentNotification`/`BSENTSMS` read-side tracking `sendMessages.cfm` needs), per-event-type
  message templates (`bema/messages/templates.cfm`/`templates_sms.cfm`, not ported), and
  per-customer language/notification-channel routing. `sendCustomerSMS.cfm`/
  `sendOnholdSMS.cfm`/`sendLinoli.cfm` appear to be earlier, narrower, possibly-superseded
  predecessors (none of them include `cron/config.cfm`, which `sendMessages.cfm` does and
  reads a live `SEND_SMS` feature flag from) — which of these are actually still live in
  production isn't establishable from the source alone. This is a materially larger, separate
  piece of work — not started here, flagged in PROGRESS.md.
- **Legacy's lack of a shared transaction** in `onhold.cfm`'s 14 statements — see that
  section above; wrapping them in one transaction here is a reliability improvement with no
  business-logic effect, not something "bugs are ported, not fixed" applies to.
