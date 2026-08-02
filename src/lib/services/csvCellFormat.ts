// Shared legacy CSV cell-formatting quirks, confirmed byte-for-byte against a real export
// pulled off the live legacy site (see docs/decisions/0015-bema-parcels-list.md and
// docs/findings.md's "Parcels list CSV export" entry) and reused as-is by
// `cron/sendLinoli.cfm`'s port (docs/decisions/0027-cron-notifications.md), which formats its
// DEBT/PAID columns with the exact same asymmetric zero rule.

/** Plain text columns: the delimiter is stripped out, not escaped — legacy never quotes a
 *  field, so a comma inside one would otherwise misalign every column after it. */
export const plainCell = (value: unknown): string => String(value ?? '').replace(/,/g, '');

/** Columns that render a single space rather than a blank cell when empty. */
export const blankAsSpace = (value: string | null | undefined): string =>
  value && value.trim() ? plainCell(value) : ' ';

/** Excel-formula-wrapped columns (the `="…"` trick that stops Excel eating a leading zero or
 *  reformatting a long numeric-looking string). Not comma-stripped: these are codes/names
 *  legacy trusted not to contain one. */
export const formulaCell = (value: string | null | undefined): string =>
  `="${value && value.trim() ? value : ' '}"`;

/** DEBT/DEBT GEL's own zero formatting: a bare trailing decimal point, no digits, when zero. */
export const debtCell = (value: number): string => (value === 0 ? '0.' : value.toFixed(2));

/** PAID/PAID GEL's own zero formatting: a bare `0`, no decimal point, when zero — deliberately
 *  different from `debtCell`'s zero rendering, not unified. */
export const paidCell = (value: number): string => (value === 0 ? '0' : value.toFixed(2));
