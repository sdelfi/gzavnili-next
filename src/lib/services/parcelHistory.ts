import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';

// Writing the legacy `ParcelHistory` edit log (docs/decisions/0018-parcel-edit-history.md).
//
// Every legacy write site and the exact tuple it inserts, transcribed from the source so the
// vocabulary this app produces is the same one the reports already know how to read:
//
// | Legacy site                                  | editStatus          | valueName      | old/new                | pay* |
// |----------------------------------------------|---------------------|----------------|------------------------|------|
// | `MSSQLParcelDAO.create()`                     | `'Added'`           | `''`           | `''`/`''`              | —    |
// | `update()` field diffs                        | parcel's status     | `'Merchant'`   | old/new store          | —    |
// |                                               |                     | `'Content'`    | old/new contents       | —    |
// |                                               |                     | `'Value'`      | old/new value          | —    |
// |                                               |                     | `'Debt'`       | old/new debt           | —    |
// | `parcels-update.cfm` partial payment          | parcel's status     | `'Partial Paid'`| `''`/`''`             | 2    |
// | `doOperation('paid')`                         | parcel's status     | `'Paid'`       | `''`/`''`              | 1    |
// | `doOperation('unpaid')`                       | `'Unpaid'`          | `'amount'`     | `''`/debt              | —    |
// | `doOperation('awb')`                          | `'Set AWB'`         | `''`           | `''`/awb               | —    |
// | `doOperation(<status op>)`                    | `'Operation changed'`| `''`          | `''`/operation         | —    |
//
// **Empty strings, not NULLs**, for every column legacy fills with `''`. This is not
// cosmetic: the report's `ph.payMethod != 'Debt'` predicate is three-valued in SQL, so a NULL
// there would silently *exclude* a row that legacy includes. Only `updaterId`/`updaterName`
// are genuinely nullable (legacy's own money-collect backfill writes a NULL updater id).

/** Legacy's `huser`: `"First Last (username)"`, the denormalized display string. */
export function formatUpdaterName(user: {
  firstName?: string | null;
  lastName?: string | null;
  username: string;
}): string {
  return `${user.firstName ?? ''} ${user.lastName ?? ''} (${user.username})`;
}

/** The acting BEMA operator, resolved once per request and threaded into the write paths —
 *  legacy read `session.buser` directly from inside the DAO. */
export type ActingUser = { id: string; name: string };

export async function resolveActingUser(userId: string): Promise<ActingUser> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, lastName: true, username: true },
  });
  return {
    id: userId,
    name: user ? formatUpdaterName(user) : '',
  };
}

export type ParcelHistoryEntry = {
  parcelId: string;
  editStatus: string;
  valueName: string;
  oldValue?: string;
  newValue?: string;
  payMethod?: string;
  payAmount?: Prisma.Decimal | number | null;
};

type Tx = Prisma.TransactionClient | typeof db;

/** Append one or more edit-log rows. Callers pass the acting operator explicitly rather than
 *  reaching for a session — these services are also called from non-request contexts. */
export async function recordParcelHistory(
  tx: Tx,
  acting: ActingUser | null,
  entries: ParcelHistoryEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  await tx.parcelHistory.createMany({
    data: entries.map((entry) => ({
      parcelId: entry.parcelId,
      editStatus: entry.editStatus,
      valueName: entry.valueName,
      oldValue: entry.oldValue ?? '',
      newValue: entry.newValue ?? '',
      payMethod: entry.payMethod ?? '',
      payAmount: entry.payAmount ?? null,
      updaterId: acting?.id ?? null,
      updaterName: acting?.name ?? null,
    })),
  });
}

/** Legacy compares the old/new *form strings* to decide whether a field changed, so a value
 *  that only differs in formatting (`5` vs `5.00`) still logs a row. Reproduced by comparing
 *  the same rendered strings rather than parsed numbers. */
export function diffEntry(
  parcelId: string,
  editStatus: string,
  valueName: string,
  oldValue: string,
  newValue: string,
): ParcelHistoryEntry | null {
  if (oldValue === newValue) return null;
  return { parcelId, editStatus, valueName, oldValue, newValue };
}
