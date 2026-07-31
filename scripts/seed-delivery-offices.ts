#!/usr/bin/env bun
// Seeds the one delivery-office row the parcel form needs but that isn't a real office:
// "Need delivery", legacy's hard-coded `<option value="999">` in the Delivery Office
// dropdown. Legacy wrote 999 into `parceloffice.officeid` as if it were an office id; here
// `office_id` is a real foreign key, so the option has to exist as a row — which is the
// right place for it anyway, since what it means ("deliver to the address instead of holding
// at an office") is a business fact, not a magic number in a template.
//
// Idempotent: matched by name, so re-running never duplicates it.
import 'dotenv/config';
import { db } from '../src/lib/db';

const NEED_DELIVERY = {
  officeName: 'Need delivery',
  officeNameGe: 'მისამართზე მიტანა',
  city: null,
  letter: 'D',
};

async function main() {
  const existing = await db.deliveryOffice.findFirst({ where: { officeName: NEED_DELIVERY.officeName } });
  if (existing) {
    console.log(`[seed-delivery-offices] "${NEED_DELIVERY.officeName}" already exists — nothing to do.`);
    return;
  }

  const office = await db.deliveryOffice.create({ data: NEED_DELIVERY });
  console.log(`[seed-delivery-offices] Created "${office.officeName}" (${office.id}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
