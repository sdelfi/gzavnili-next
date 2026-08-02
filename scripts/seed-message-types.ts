#!/usr/bin/env bun
// Seeds the fixed reference list backing the legacy "Edit Customer" screen's per-event
// notification checkbox grid (see prisma/schema.prisma's `MessageType` doc comment), plus
// (added for docs/decisions/0027-cron-notifications.md) the `operation` mapping
// `cron/sendMessages.cfm`'s port uses to route an `operations`-table event to a template.
//
// The `operation` values are the best evidence available without direct access to the
// legacy `MessageTypes` table's real data: `sendMessages.cfm`'s own trailing comment block
// (`operation name -> DB messagetype id`), cross-checked against which numbered template
// (`bema/messages/templates.cfm`/`templates_sms.cfm`) actually exists and what it says. Two
// entries are flagged where those two sources disagree or the mapping reads oddly even
// though it's what the comment says — see docs/findings.md for the specific evidence trail;
// ported as the comment states, not "corrected" to what seems more sensible.
// Idempotent (upsert by key) — safe to run any number of times, including after adding a
// new type here later.
import 'dotenv/config';
import { db } from '../src/lib/db';

const MESSAGE_TYPES: { key: string; label: string; operation?: string }[] = [
  { key: 'parcel_picked_up', label: 'Parcel was picked up', operation: 'pickedup' },
  { key: 'parcel_received', label: 'We just got your parcel(s)', operation: 'received' },
  // Comment says operation "custom" routes to id 10, but no id-10 template exists in either
  // templates file; id 12's actual content ("held for inspection... Georgian customs") is
  // unambiguously this one. Mapped by content, not by the comment's stale id.
  { key: 'parcel_customs_hold', label: 'Parcel stopped by customs', operation: 'custom' },
  { key: 'parcel_added', label: 'Just add parcel' },
  { key: 'parcel_shipped_region', label: 'Parcel shipped to region', operation: 'region' },
  { key: 'promotion', label: 'Promotion notification' },
  { key: 'payment_reminder', label: 'Payment Reminder' },
  { key: 'parcel_damaged', label: 'Damaged Parcel' },
  { key: 'ready_to_pickup', label: 'Ready to pickup', operation: 'office' },
  // The comment maps operation "missed" to this same id (3) — despite id 3's actual content
  // being about an incomplete customs declaration, not a missed delivery/pickup attempt.
  // Ported as the comment states.
  { key: 'missing_information', label: 'Missing information', operation: 'missed' },
  { key: 'parcel_delivered', label: 'Parcel Delivered', operation: 'delivered' },
  { key: 'other', label: 'Other' },
  { key: 'out_for_delivery', label: 'Out for Delivery', operation: 'outdelivery' },
  { key: 'parcel_departed', label: 'Parcel(s) Departed', operation: 'shipped' },
];

async function main() {
  for (const [index, type] of MESSAGE_TYPES.entries()) {
    await db.messageType.upsert({
      where: { key: type.key },
      update: { label: type.label, sortOrder: index, operation: type.operation ?? null },
      create: { key: type.key, label: type.label, sortOrder: index, operation: type.operation ?? null },
    });
  }
  console.log(`[seed-message-types] Upserted ${MESSAGE_TYPES.length} message types.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
