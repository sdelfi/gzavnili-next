import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';

// "Export Airway" on the bema parcels list (legacy `export=2` → `bema/parcels/airway.cfm`) —
// an air cargo manifest document for the airline, not a view of the parcels screen. Its exact
// byte-for-byte formatting (line breaks, the mid-row blank lines, the trailing tab on the two
// AIRPORT lines, the header row's own `\r\n` where every other line uses a bare `\n`, the
// un-decoded `&nbsp;` entities in CONSIGNEE) is confirmed against a real export pulled off the
// live legacy site (`tmp/airway_export.csv`).
//
// A first pass at this route (written with no `airway.cfm` source to check against, only that
// sample export) guessed Airway Bill/Consignee/Shipment Date were fixed constants baked into
// the export — they are not. With the real source now available: `Airway Bill:` and
// `SHIPMENT DATE:` come from `config.getAIRWAYBill()`/`config.getAIRWAYdate()` (the manifest's
// own bill/date, distinct from `regAwb`/`expAwb`'s trip AWB codes — the earlier guess used the
// wrong field entirely), and `CONSIGNEE:` is `config.getCONSIGNEE()` with any HTML tags
// stripped (`ReReplaceNoCase(..., "<[^>]*>", "", "ALL")`) — an admin-editable settings field
// (bema "Site Settings"), not a hardcoded shipping record. `tmp/airway_export.csv` just
// reflected whatever `config` held at export time; the un-decoded `&nbsp;` entities are real
// content someone typed into the Consignee field, not a static literal, and are preserved
// as-is here since legacy's tag-strip regex doesn't touch HTML entities.
//
// SHIPPER NAME and the two AIRPORT OF fields genuinely are hardcoded in `airway.cfm` itself
// (not read from `config`) — those stay as literals.
//
// Not ported: `airway.cfm` also queries parcels/receivers with `tripdate = config.AirwayDate`
// and fills NO. OF PIECES/TOTAL ACTUAL WEIGHT/TOTAL Value plus a data row per receiver — this
// route still always emits an empty data-row table. That's a separate, substantially larger
// piece of `airway.cfm`'s own business logic (parcels data, not settings data) — tracked as an
// open item in docs/findings.md rather than guessed at here.
const EXPORT_ROLES = ['BemaStandard', 'BemaAdministrator', 'BemaAgent'] as const;

const COLUMNS = [
  'HAWB',
  'No. of Pieces',
  'Account ID',
  'Carrier Tracking Number (s)',
  'Shipper Name',
  'Shipper Address',
  'Consignee Name',
  'Consignee Address',
  'ActualWeight',
  'Value of HAWB',
  'Description of Contents',
];

const SHIPPER = 'AGU LLC, 1576 East 19th Street, Apt 4C, Brooklyn, NY 11230';

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, '');
}

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...EXPORT_ROLES]);
  if (auth.response) return auth.response;

  const config = await db.config.findUnique({ where: { id: 1 } });
  const airwayBill = config?.airwayBill ?? '';
  const shipmentDate = config?.airwayDate
    ? `${String(config.airwayDate.getUTCMonth() + 1).padStart(2, '0')}/${String(config.airwayDate.getUTCDate()).padStart(2, '0')}/${config.airwayDate.getUTCFullYear()}`
    : '';
  const consignee = stripTags(config?.consignee ?? '');

  const body =
    'Air Cargo Manifest\n' +
    `Airway Bill:,${airwayBill}\n` +
    '\n' +
    `SHIPMENT DATE:,${shipmentDate}\n` +
    '\n' +
    `SHIPPER NAME:,"${SHIPPER}"\n` +
    '\n' +
    `CONSIGNEE:,"${consignee}"\n` +
    '\n' +
    'AIRPORT OF DEPARTURE:, JFK\t\n' +
    'AIRPORT OF DESTINATION:, TBS\t\n' +
    'NO. OF PIECES:,\n' +
    'TOTAL ACTUAL WEIGHT:,\n' +
    'TOTAL Value:,\n' +
    '\n' +
    `${COLUMNS.join(',')}\r\n`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="airway.csv"',
    },
  });
}
