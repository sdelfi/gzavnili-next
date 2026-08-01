#!/usr/bin/env bun
// Seeds the two placeholder "shipper" customer accounts the "Add Online Parcel" screen's
// Unknown/Linoli tabs assign new parcels to (legacy `bema/parcels/parcels-online-add-2.cfm`,
// see docs/decisions/0022-parcels-online-add.md). Legacy hardcodes these by MSSQL GUID, with
// a comment recording which username each one is:
//
//   GZ20000 - unknown // C1021448-EB3F-A629-48546EBF621E1E9A // live 58133650-0FEC-1BB8-...
//   GZ20001 - linoli  // C10B4854-AD84-B750-CDEDE4BB480F37D7 // live 581ACE56-EEE2-E30F-...
//
// Those ids don't exist in this schema (every id here is freshly generated on create) — same
// situation as `agent-prefix-map.cfm`'s hardcoded GUIDs (docs/decisions/0017-bema-add-
// parcel.md), except these two are load-bearing (the parcel's actual owning customer), not
// cosmetic, so they can't just be dropped. Resolved by username instead, the same fix already
// used for `batchPricing.ts`'s `AGENT_RATE_EXCLUDED_USERNAMES`.
//
// Idempotent (upsert by username) — safe to run any number of times.
import 'dotenv/config';
import { db } from '../src/lib/db';

const SHIPPERS = [
  { username: 'GZ20000', email: 'gz20000@placeholder.gzavnili.com', firstName: 'Unknown', lastName: 'Shipper' },
  { username: 'GZ20001', email: 'gz20001@placeholder.gzavnili.com', firstName: 'Linoli', lastName: 'Shipper' },
];

async function main() {
  for (const shipper of SHIPPERS) {
    const user = await db.user.upsert({
      where: { username: shipper.username },
      update: {},
      create: {
        username: shipper.username,
        email: shipper.email,
        firstName: shipper.firstName,
        lastName: shipper.lastName,
        accountType: 'Customer',
      },
    });
    console.log(`[seed-parcel-shippers] "${shipper.username}" ready (${user.id}).`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
