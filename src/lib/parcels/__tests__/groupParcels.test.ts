import { describe, expect, test } from 'bun:test';
import { groupParcels, selectionDebt } from '../groupParcels';
import type { ParcelListItem } from '../types';

// The list is not a flat table — it groups rows into shipment cards, and getting the key
// wrong merges two senders' parcels into one card or splits one shipment across several.

const parcel = (over: Partial<ParcelListItem> & { id: string }): ParcelListItem =>
  ({
    trackingNum: null,
    trackingNum2: null,
    awb: null,
    pcode: null,
    groupId: '1',
    service: 'Regular',
    parcelType: null,
    contents: null,
    notes: null,
    location: null,
    officeName: null,
    store: null,
    created: '2026-07-18T10:15:00.000Z',
    tripDate: '2026-07-20T00:00:00.000Z',
    weight: null,
    value: null,
    debt: 0,
    length: null,
    width: null,
    high: null,
    dimWeight: null,
    status: 'New',
    isPaid: false,
    isInvoiced: false,
    invoiceId: null,
    topFlag: false,
    bPaidDelivery: false,
    payMethod1: null,
    payMethod2: null,
    payAmount1: null,
    payAmount2: null,
    onlineSource: null,
    additionalUsername: null,
    additionalFirstname: null,
    additionalLastname: null,
    buser: null,
    buserName: null,
    trackingAway: null,
    trackingReceived: null,
    trackingEstDelivery: null,
    trackingEstShip: null,
    trackingShipped: null,
    trackingDelay: null,
    trackingCustom: null,
    trackingProcessingCustom: null,
    trackingOffice: null,
    trackingOutDelivery: null,
    trackingSendRegion: null,
    trackingDeliveredSigned: null,
    user: { id: 'u1', username: 'GZ1', firstName: 'Nino', lastName: 'Beridze', balance: 0 },
    receiver: null,
    receivedByName: null,
    ...over,
  }) as ParcelListItem;

describe('groupParcels', () => {
  test('one sender, one trip, one minute → one card', () => {
    const groups = groupParcels([parcel({ id: 'a' }), parcel({ id: 'b' })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].parcels.map((p) => p.id)).toEqual(['a', 'b']);
  });

  test('different senders never share a card', () => {
    const other = parcel({
      id: 'b',
      user: { id: 'u2', username: 'GZ2', firstName: 'Ana', lastName: 'Lomidze', balance: 0 },
    });
    expect(groupParcels([parcel({ id: 'a' }), other])).toHaveLength(2);
  });

  test('different trip dates split the card', () => {
    expect(groupParcels([parcel({ id: 'a' }), parcel({ id: 'b', tripDate: '2026-08-01T00:00:00.000Z' })])).toHaveLength(
      2,
    );
  });

  test('different group numbers split the card', () => {
    expect(groupParcels([parcel({ id: 'a' }), parcel({ id: 'b', groupId: '2' })])).toHaveLength(2);
  });

  test('created is compared to the minute, not the second', () => {
    const sameMinute = groupParcels([
      parcel({ id: 'a', created: '2026-07-18T10:15:00.000Z' }),
      parcel({ id: 'b', created: '2026-07-18T10:15:59.000Z' }),
    ]);
    expect(sameMinute).toHaveLength(1);

    const nextMinute = groupParcels([
      parcel({ id: 'a', created: '2026-07-18T10:15:00.000Z' }),
      parcel({ id: 'b', created: '2026-07-18T10:16:00.000Z' }),
    ]);
    expect(nextMinute).toHaveLength(2);
  });

  test('pinned shipments sort above everything else regardless of date', () => {
    const groups = groupParcels([
      parcel({ id: 'new', created: '2026-07-30T10:00:00.000Z' }),
      parcel({ id: 'pinned', created: '2020-01-01T10:00:00.000Z', topFlag: true, groupId: '9' }),
    ]);
    expect(groups[0].parcels[0].id).toBe('pinned');
  });

  test('newest shipment first among unpinned', () => {
    const groups = groupParcels([
      parcel({ id: 'older', created: '2026-07-01T10:00:00.000Z', groupId: '1' }),
      parcel({ id: 'newer', created: '2026-07-30T10:00:00.000Z', groupId: '2' }),
    ]);
    expect(groups.map((g) => g.parcels[0].id)).toEqual(['newer', 'older']);
  });

  test('row order inside a card is left as the server sent it', () => {
    const groups = groupParcels([parcel({ id: 'second' }), parcel({ id: 'first' })]);
    expect(groups[0].parcels.map((p) => p.id)).toEqual(['second', 'first']);
  });
});

describe('selectionDebt', () => {
  test('sums only the selected rows, treating a null debt as zero', () => {
    const items = [parcel({ id: 'a', debt: 45.5 }), parcel({ id: 'b', debt: 12 }), parcel({ id: 'c', debt: null })];
    expect(selectionDebt(items, new Set(['a', 'b']))).toBe(57.5);
    expect(selectionDebt(items, new Set(['c']))).toBe(0);
    expect(selectionDebt(items, new Set())).toBe(0);
  });
});
