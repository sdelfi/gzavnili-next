// Display formatting for the bema parcels screens. Legacy renders dates with ColdFusion's
// `dateFormat(x, "mm/dd/yyyy")` and `timeFormat(x)` (12-hour with an am/pm marker) — the US
// office's convention, and what every operator reading these screens expects — so that is
// what these reproduce, via a fixed `en-US`/UTC formatter rather than the visitor's locale.
//
// UTC, not local time: the API sends instants, and two operators in Tbilisi and New York
// looking at the same delivery timestamp must read the same number off the screen. The
// alternative — formatting per browser — would silently shift every milestone by 8 hours
// depending on who opened the list.

const DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
});

const TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : DATE.format(date);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : `${DATE.format(date)} ${TIME.format(date)}`;
}

/** Legacy `numberFormat(x, "_.__")`: two decimals, and blank rather than `0.00` when there
 *  is no figure at all — the distinction between "weighed 0" and "not weighed yet". */
export function formatAmount(value: number | null | undefined): string {
  return value == null ? '' : value.toFixed(2);
}

/** The USD amount with its GEL equivalent, the pairing every money figure on this screen
 *  uses. `rate` is `config.crate`; without one, only the USD figure is shown. */
export function formatWithLari(value: number | null | undefined, rate: number | null): string {
  if (value == null) return '';
  const usd = value.toFixed(2);
  return rate ? `${usd} (${(value * rate).toFixed(2)} GEL)` : usd;
}
