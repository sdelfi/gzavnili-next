import { NextRequest, NextResponse } from 'next/server';
import { requireBemaSession } from '@/lib/auth/session';

// "Export Airway" on the bema parcels list (legacy `export=2` → `airway.cfm`) — a manifest
// document for the airline, not a view of the parcels screen. Legacy's own airway.cfm never
// populates any rows: clicking it always downloads just the title and header line, regardless
// of the filters applied on screen. That is a genuine bug (a dead manifest export), not a
// missing feature — ported as-is per findings.md rather than "fixed" into a real per-parcel
// export, since there is no legacy source describing what row data it was ever meant to carry.
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

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...EXPORT_ROLES]);
  if (auth.response) return auth.response;

  const lines = ['Air Cargo Manifest', COLUMNS.join(',')];

  return new NextResponse(`﻿${lines.join('\n')}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="airway.csv"',
    },
  });
}
