import type { ParcelGroup, ParcelListItem } from './types';

// The bema parcels list is not a flat table: each card is one *shipment* — everything one
// sender booked onto one trip, in one group, in one go. Legacy produced these cards with a
// query-of-query (`select … from results group by tCreated, TripDate, UserId, …` in
// views/parcels/vwParcels_work2.cfm), re-querying the page's rows once per card. Same
// grouping, done once over the rows already in memory.
//
// The parts of the key, and why each is there:
// * `topFlag` — legacy loops the whole render twice, `topFlag = 0` then `1`, so pinned
//   shipments sort above everything else regardless of date.
// * `userId` + `groupId` — the sender, and their own numbering of the shipment.
// * `tripDate` — which flight/trip it goes on.
// * `created` truncated to the minute — legacy's `CONVERT(CHAR(18), created, 113) + '00'`,
//   which is what separates two batches the same sender entered at different times of day.

const minuteKey = (iso: string) => iso.slice(0, 16);

export function groupParcels(items: ParcelListItem[]): ParcelGroup[] {
  const groups = new Map<string, ParcelGroup>();

  for (const item of items) {
    const key = [
      item.topFlag ? '1' : '0',
      item.user.id,
      item.groupId ?? '',
      item.tripDate ?? '',
      minuteKey(item.created),
    ].join('|');

    const existing = groups.get(key);
    if (existing) {
      existing.parcels.push(item);
      continue;
    }

    // Service/AWB/code are shipment-level facts shown in the card header; legacy reads them
    // off whichever row came first, and so does this.
    groups.set(key, {
      key,
      topFlag: item.topFlag,
      user: item.user,
      groupId: item.groupId,
      tripDate: item.tripDate,
      service: item.service,
      awb: item.awb,
      pcode: item.pcode,
      parcels: [item],
    });
  }

  // Pinned shipments first, then newest first — matching legacy's outer `topFlag` loop and
  // its `order by tCreated desc, TripDate desc, UserLastName, UserFirstName, Username,
  // GroupId asc`. Rows *within* a card keep the order the server sent them.
  return [...groups.values()].sort((a, b) => {
    if (a.topFlag !== b.topFlag) return a.topFlag ? -1 : 1;
    const created = minuteKey(b.parcels[0].created).localeCompare(minuteKey(a.parcels[0].created));
    if (created !== 0) return created;
    const trip = (b.tripDate ?? '').localeCompare(a.tripDate ?? '');
    if (trip !== 0) return trip;
    const lastName = (a.user.lastName ?? '').localeCompare(b.user.lastName ?? '');
    if (lastName !== 0) return lastName;
    const firstName = (a.user.firstName ?? '').localeCompare(b.user.firstName ?? '');
    if (firstName !== 0) return firstName;
    const username = a.user.username.localeCompare(b.user.username);
    if (username !== 0) return username;
    return (a.groupId ?? '').localeCompare(b.groupId ?? '');
  });
}

/** Total outstanding debt across a selection — the running figure the legacy list shows in
 *  red above the operations bar (`calcDebt()` in bema/include/js/bema.js). */
export function selectionDebt(items: ParcelListItem[], selectedIds: ReadonlySet<string>): number {
  return items.reduce((total, item) => (selectedIds.has(item.id) ? total + (item.debt ?? 0) : total), 0);
}
