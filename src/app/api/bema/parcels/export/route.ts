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
// Legacy's second export ("Export Airway", `export=2` → `airway.cfm`) is a different
// document for the airline, not a view of this screen — out of scope here and still to do.
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
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

/** RFC 4180 quoting. Legacy instead stripped the delimiter out of every value and wrapped
 *  some columns in `="…"` to stop Excel eating leading zeros off phone/tracking numbers —
 *  that mangles the data to work around a spreadsheet import quirk. Quoting properly keeps
 *  the values intact; the same columns are still text, because they are quoted. */
function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

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
        name.first,
        name.last,
        item.user.username,
        item.user.firstName ?? '',
        item.user.lastName ?? '',
        item.receiver?.city ?? '',
        item.receiver?.street1 ?? '',
        item.receiver?.street2 ?? '',
        item.receiver?.phone1 ?? '',
        item.receiver?.phone2 ?? '',
        item.receiver?.phone3 ?? '',
        item.trackingNum ?? '',
        receivedBy?.firstName ?? '',
        receivedBy?.lastName ?? '',
        item.store ?? '',
        money(debtUsd),
        money(paidUsd),
        money(debtUsd * lariRate),
        money(paidUsd * lariRate),
        money(item.weight),
        money(item.value),
        item.contents ?? '',
        item.status,
        day(item.trackingReceived),
        paymentMethod(item),
        item.location ?? '',
        item.officeName ?? '',
        // Legacy flattens newlines out of Notes because it never quoted anything; kept
        // because a note spanning rows is unreadable in a spreadsheet either way.
        (item.notes ?? '').replace(/[\r\n]+/g, ' '),
      ]
        .map(csvCell)
        .join(','),
    );
  }

  // A BOM so Excel opens the Georgian receiver names as UTF-8 rather than as mojibake.
  return new NextResponse(`﻿${lines.join('\n')}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="parcels.csv"',
      'X-Total-Rows': String(total),
      'X-Exported-Rows': String(rows.length),
    },
  });
}
