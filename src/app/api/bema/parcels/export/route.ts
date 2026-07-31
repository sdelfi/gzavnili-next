import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireBemaSession } from '@/lib/auth/session';
import { listParcelsQuerySchema } from '@/lib/validation/parcelSchema';
import {
  PARCEL_LIST_INCLUDE,
  buildParcelOrderBy,
  buildParcelWhere,
  loadAdminNames,
  toParcelListItem,
} from '@/lib/services/parcelQuery';
import type { ParcelListItem } from '@/lib/parcels/types';

// "Export Parcels" on the bema parcels list — the same filtered set as the screen, as CSV.
// Column list and per-column fallbacks are ported from `bema/parcels/parcels.cfm`'s
// `url.export eq 1` branch (its third and final `content` header assignment; the two before
// it are earlier, overwritten versions of the same line).
//
// Every quirk below is confirmed byte-for-byte against a real export pulled off the live
// legacy site (`tmp/parcels_export.csv`), not guessed — an earlier version of this route had
// replaced legacy's actual formatting with clean RFC 4180 quoting and a UTF-8 BOM as an
// "improvement". That was a real deviation, reverted here:
// * No BOM — legacy's file starts directly with the header, no `﻿`.
// * Plain text columns never get CSV-quoted, even when the value contains a comma — a comma
//   inside one of these is stripped instead (the delimiter itself is removed, not escaped).
// * Seven columns are wrapped in Excel's `="…"` formula syntax instead — PHONE, PHONE2,
//   PRIVATE NUMBER, TRACKING #, "Received By First/Last Name", and PARCEL CONTENT — the
//   trick that stops Excel eating a leading zero or reformatting a long numeric-looking
//   string. Empty values in these columns render `=" "` (a literal single space inside the
//   formula), not `=""`.
// * Five receiver/customer columns (FIRST NAME, LAST NAME, ADDRESS, UBANY, STORE NAME) render
//   a single space when empty rather than a blank cell; the remaining plain columns (Status,
//   Received in USA, Payment method, Location, Office Name, Notes) render genuinely empty.
// * DEBT/DEBT GEL render `0.` (a bare trailing decimal point, no digits after it) when the
//   value is exactly zero; PAID/PAID GEL render a bare `0` (no decimal point at all) when
//   zero. Any non-zero amount, and WEIGHT/VALUE regardless of value, always render with two
//   decimals as normal. Two different legacy code paths formatting the same "zero" value two
//   different ways — kept exactly, not unified into one.
//
// Legacy's second export ("Export Airway", `export=2` → `airway.cfm`) is a different
// document for the airline — see `/api/bema/parcels/export-airway`.
//
// One legacy line is deliberately not ported: it rewrites the USERNAME column to
// `"Linoli " & additional_username` for the single hard-coded account `GZ20001`. That is a
// per-customer hack in a generic export, not a rule — if it is still wanted it belongs in
// data (an account-level "export as" name), not in this file.
const EXPORT_ROLES = ['BemaStandard', 'BemaAdministrator', 'BemaAgent'] as const;

// Legacy caps the export at 9999 rows by passing `recordsPerPage = 9999`, silently
// truncating anything larger. Kept, with the truncation reported in a response header
// instead of going unnoticed.
const EXPORT_LIMIT = 9999;

const COLUMNS = [
  'FIRST NAME',
  'LAST NAME',
  'USERNAME',
  'USERFIRSTNAME',
  'USERLASTNAME',
  'CITY',
  'ADDRESS',
  'UBANY',
  'PHONE',
  'PHONE2',
  'PRIVATE NUMBER',
  'TRACKING #',
  'Received By First Name',
  'Received By Last Name',
  'STORE NAME',
  'DEBT',
  'PAID',
  'DEBT GEL',
  'PAID GEL',
  'WEIGHT',
  'VALUE',
  'PARCEL CONTENT',
  'Status',
  'Received in USA',
  'Payment method',
  'Location',
  'Office Name',
  'Notes',
];

const money = (value: number | null | undefined) => (value == null ? '0.00' : value.toFixed(2));
/** DEBT/DEBT GEL's own zero formatting — see the file header. */
const debtCell = (value: number) => (value === 0 ? '0.' : value.toFixed(2));
/** PAID/PAID GEL's own zero formatting — see the file header. */
const paidCell = (value: number) => (value === 0 ? '0' : value.toFixed(2));
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

/** Plain text columns: the delimiter is stripped out, not escaped — legacy never quotes a
 *  field, so a comma inside one would otherwise misalign every column after it. */
const plainCell = (value: unknown) => String(value ?? '').replace(/,/g, '');
/** The five receiver/customer columns that render a single space rather than a blank cell
 *  when empty. */
const blankAsSpace = (value: string | null | undefined) => (value && value.trim() ? plainCell(value) : ' ');
/** The seven Excel-formula-wrapped columns — see the file header. Not comma-stripped: these
 *  are codes/names legacy trusted not to contain one. */
const formulaCell = (value: string | null | undefined) => `="${value && value.trim() ? value : ' '}"`;

/** Legacy display fallbacks, in order: the receiver's Georgian name stands in for a missing
 *  Latin one, and the "additional" free-text name stands in for a missing receiver record. */
function receiverName(item: ParcelListItem): { first: string; last: string } {
  const r = item.receiver;
  return {
    first: r?.firstName || r?.firstNameGe || item.additionalFirstname || '',
    last: r?.lastName || r?.lastNameGe || item.additionalLastname || '',
  };
}

/** Mirrors the row's own "Pay Method" display: an online payment source wins over the
 *  recorded method, and cash/card taken in the US is labelled as such. */
function paymentMethod(item: ParcelListItem): string {
  if (item.onlineSource && item.onlineSource.length > 1) {
    return item.onlineSource.replace('Credit Card', 'CC Online');
  }
  if (item.payMethod1 === 'Cash' || item.payMethod1 === 'Creditcard') return `${item.payMethod1} US`;
  return item.payMethod1 ?? '';
}

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...EXPORT_ROLES]);
  if (auth.response) return auth.response;

  const parsed = listParcelsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const query = parsed.data;
  if (auth.session.role === 'BemaAgent') query.receivedBy = auth.session.sub;

  const where = buildParcelWhere(query);
  const [total, rows, config] = await Promise.all([
    db.parcel.count({ where }),
    db.parcel.findMany({
      where,
      orderBy: buildParcelOrderBy(query.sort, query.dir),
      take: EXPORT_LIMIT,
      include: PARCEL_LIST_INCLUDE,
    }),
    db.config.findUnique({ where: { id: 1 }, select: { crate: true } }),
  ]);

  const adminNames = await loadAdminNames(rows);
  const lariRate = config?.crate ? Number(config.crate) || 0 : 0;

  const lines = [COLUMNS.join(',')];
  for (const row of rows) {
    const item = toParcelListItem(row, adminNames);
    const name = receiverName(item);
    const receivedBy = row.trackingReceivedBy ? adminNames.get(row.trackingReceivedBy) : undefined;
    const debt = item.debt ?? 0;

    // One of the two money columns is always zero: an invoiced parcel's debt has been paid,
    // an uninvoiced one's has not.
    const [debtUsd, paidUsd] = item.isPaid ? [0, debt] : [debt, 0];

    lines.push(
      [
        blankAsSpace(name.first),
        blankAsSpace(name.last),
        plainCell(item.user.username),
        plainCell(item.user.firstName ?? ''),
        plainCell(item.user.lastName ?? ''),
        plainCell(item.receiver?.city ?? ''),
        blankAsSpace(item.receiver?.street1),
        blankAsSpace(item.receiver?.street2),
        formulaCell(item.receiver?.phone1),
        formulaCell(item.receiver?.phone2),
        formulaCell(item.receiver?.phone3),
        formulaCell(item.trackingNum),
        formulaCell(receivedBy?.firstName ?? ''),
        formulaCell(receivedBy?.lastName ?? ''),
        blankAsSpace(item.store),
        debtCell(debtUsd),
        paidCell(paidUsd),
        debtCell(debtUsd * lariRate),
        paidCell(paidUsd * lariRate),
        money(item.weight),
        money(item.value),
        formulaCell(item.contents),
        plainCell(item.status),
        plainCell(day(item.trackingReceived)),
        plainCell(paymentMethod(item)),
        plainCell(item.location ?? ''),
        plainCell(item.officeName ?? ''),
        // Legacy flattens newlines out of Notes because it never quoted anything; kept
        // because a note spanning rows is unreadable in a spreadsheet either way.
        plainCell((item.notes ?? '').replace(/[\r\n]+/g, ' ')),
      ].join(','),
    );
  }

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="parcels.csv"',
      'X-Total-Rows': String(total),
      'X-Exported-Rows': String(rows.length),
    },
  });
}
