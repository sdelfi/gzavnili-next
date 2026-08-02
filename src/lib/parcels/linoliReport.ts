import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email/sendEmail';
import { blankAsSpace, debtCell, formulaCell, paidCell } from '@/lib/services/csvCellFormat';

// Ports `cron/sendLinoli.cfm` — not an SMS/notification job at all (unlike its neighbors in
// `http/cron/`): a daily CSV manifest of the "Linoli" placeholder shipper's (`GZ20001`, see
// docs/decisions/0022-parcels-online-add.md) not-yet-delivered parcels received today, emailed
// as an attachment to a business partner. See docs/decisions/0027-cron-notifications.md.
//
// Not reproduced: legacy rewrites each row's USERNAME to `"Linoli " & additional_username`,
// and falls back to `additional_firstname`/`additional_lastname` for a blank receiver name —
// both sourced from a DAO join this schema has no equivalent for. Same gap, same call, as the
// already-shipped "Export Parcels" CSV (docs/decisions/0015-bema-parcels-list.md's "GZ20001
// special-case" note) — not re-litigated here.
const LINOLI_USERNAME = 'GZ20001';
const REPORT_FROM = 'info@gzavnili.com';
const REPORT_TO = 'info@linoni.ge';
const REPORT_CC = 'linoni.ge@gmail.com';
const REPORT_BCC = 'driker@ecomsolutions.net,irakli@gzavnili.com';

export type LinoliRow = {
  receiverFirstName: string | null;
  receiverLastName: string | null;
  username: string;
  city: string | null;
  street1: string | null;
  street2: string | null;
  phone1: string | null;
  phone2: string | null;
  phone3: string | null;
  trackingNum: string | null;
  store: string | null;
  debt: number;
  isPaid: boolean;
  weight: number;
  value: number;
  contents: string | null;
};

const money = (value: number) => value.toFixed(2);

export function buildLinoliCsv(rows: LinoliRow[]): string {
  const header = [
    'FIRST NAME',
    'LAST NAME',
    'USERNAME',
    'CITY',
    'ADDRESS',
    'UBANY',
    'PHONE',
    'PHONE2',
    'PRIVATE NUMBER',
    'TRACKING #',
    'STORE NAME',
    'DEBT',
    'PAID',
    'WEIGHT',
    'VALUE',
    'PARCEL CONTENT',
  ].join(',');

  const lines = [header];
  for (const row of rows) {
    const [debtAmount, paidAmount] = row.isPaid ? [0, row.debt] : [row.debt, 0];
    lines.push(
      [
        blankAsSpace(row.receiverFirstName),
        blankAsSpace(row.receiverLastName),
        row.username,
        blankAsSpace(row.city),
        blankAsSpace(row.street1),
        blankAsSpace(row.street2),
        formulaCell(row.phone1),
        formulaCell(row.phone2),
        formulaCell(row.phone3),
        formulaCell(row.trackingNum),
        blankAsSpace(row.store),
        debtCell(debtAmount),
        paidCell(paidAmount),
        money(row.weight),
        money(row.value),
        formulaCell(row.contents),
      ].join(','),
    );
  }
  return lines.join('\n');
}

export async function runLinoliReport(): Promise<string> {
  const linoliUser = await db.user.findUnique({ where: { username: LINOLI_USERNAME } });
  if (!linoliUser) return `no ${LINOLI_USERNAME} account found`;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

  const parcels = await db.parcel.findMany({
    where: {
      userId: linoliUser.id,
      trackingReceived: { gte: todayStart, lt: tomorrowStart },
      trackingDeliveredSigned: null,
    },
    include: { receiver: { include: { address: true } } },
  });

  if (!parcels.length) return 'no parcels to report';

  const rows: LinoliRow[] = parcels.map((parcel) => {
    const address = parcel.receiver?.address;
    return {
      receiverFirstName: address?.firstName || address?.firstNameGe || null,
      receiverLastName: address?.lastName || address?.lastNameGe || null,
      username: linoliUser.username,
      city: address?.city ?? null,
      street1: address?.street1 ?? null,
      street2: address?.street2 ?? null,
      phone1: address?.cellPhone ?? null,
      phone2: address?.homePhone ?? null,
      phone3: address?.privateNumber ?? null,
      trackingNum: parcel.trackingNum,
      store: parcel.store,
      debt: parcel.debt ? Number(parcel.debt) : 0,
      isPaid: parcel.isPaid,
      weight: parcel.weight ? Number(parcel.weight) : 0,
      value: parcel.value ? Number(parcel.value) : 0,
      contents: parcel.contents,
    };
  });

  const csv = buildLinoliCsv(rows);
  const dateStamp = todayStart.toISOString().slice(0, 10);

  await sendEmail({
    from: REPORT_FROM,
    to: REPORT_TO,
    cc: REPORT_CC,
    bcc: REPORT_BCC,
    subject: 'Gzavnili report - Received in USA',
    text: 'Gzavnili report',
    attachments: [{ filename: `Linoli${dateStamp}.csv`, content: csv }],
  });

  return `reported ${rows.length} parcel(s)`;
}
