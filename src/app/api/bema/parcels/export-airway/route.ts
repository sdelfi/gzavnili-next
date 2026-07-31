import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';

// "Export Airway" on the bema parcels list (legacy `export=2` → `airway.cfm`) — an air cargo
// manifest document for the airline, not a view of the parcels screen. Its exact byte-for-byte
// content (line breaks, the mid-row blank lines, the trailing tab on the two AIRPORT lines, the
// header row's own `\r\n` where every other line uses a bare `\n`, the un-decoded `&nbsp;`
// entities in CONSIGNEE) is confirmed against a real export pulled off the live legacy site
// (`tmp/airway_export.csv`) — a first pass at this route, written with no source to check
// against, had guessed the whole document was an empty stub. It is not: only the manifest's
// data-row table (the header row below) is ever empty — everything above it is a populated,
// mostly-static manifest header.
//
// SHIPPER NAME/CONSIGNEE/the two AIRPORT OF fields never vary per request — this is a single
// fixed US-warehouse-to-Georgia-office shipment record legacy hardcodes into every export, not
// data this schema stores anywhere. Only the Airway Bill code varies, and even that isn't
// confirmed against a real `airway.cfm`/DAO source: `config.regAwb` (falling back to
// `config.expAwb`) is inferred from those being the only AWB-shaped fields this schema has, not
// verified against which service this particular export actually corresponds to — see
// docs/findings.md.
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
// Legacy never decodes these `&nbsp;` entities before writing the CSV cell — kept literal.
const CONSIGNEE = 'GZAVNILI GE LTD,&nbsp; 41 212tashkentis&nbsp; ST.&nbsp; TBILISI GEORGIA 0160 995322470022';

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...EXPORT_ROLES]);
  if (auth.response) return auth.response;

  const config = await db.config.findUnique({ where: { id: 1 } });
  const awb = config?.regAwb || config?.expAwb || '';

  const body =
    'Air Cargo Manifest\n' +
    `Airway Bill:,${awb}\n` +
    '\n' +
    'SHIPMENT DATE:,\n' +
    '\n' +
    `SHIPPER NAME:,"${SHIPPER}"\n` +
    '\n' +
    `CONSIGNEE:,"${CONSIGNEE}"\n` +
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
