#!/usr/bin/env bun
// Seeds the fixed reference list backing the legacy "Edit Customer" screen's per-event
// notification checkbox grid (see prisma/schema.prisma's `MessageType` doc comment).
// Idempotent (upsert by key) — safe to run any number of times, including after adding a
// new type here later.
import 'dotenv/config';
import { db } from '../src/lib/db';

const MESSAGE_TYPES = [
  { key: 'parcel_picked_up', label: 'Parcel was picked up' },
  { key: 'parcel_received', label: 'We just got your parcel(s)' },
  { key: 'parcel_customs_hold', label: 'Parcel stopped by customs' },
  { key: 'parcel_added', label: 'Just add parcel' },
  { key: 'parcel_shipped_region', label: 'Parcel shipped to region' },
  { key: 'promotion', label: 'Promotion notification' },
  { key: 'payment_reminder', label: 'Payment Reminder' },
  { key: 'parcel_damaged', label: 'Damaged Parcel' },
  { key: 'ready_to_pickup', label: 'Ready to pickup' },
  { key: 'missing_information', label: 'Missing information' },
  { key: 'parcel_delivered', label: 'Parcel Delivered' },
  { key: 'other', label: 'Other' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'parcel_departed', label: 'Parcel(s) Departed' },
];

async function main() {
  for (const [index, type] of MESSAGE_TYPES.entries()) {
    await db.messageType.upsert({
      where: { key: type.key },
      update: { label: type.label, sortOrder: index },
      create: { key: type.key, label: type.label, sortOrder: index },
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
