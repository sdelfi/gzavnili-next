import { describe, expect, test } from 'bun:test';
import { notesRequired, parcelDetailToForm, parcelFormToPayload } from '../form';
import { updateParcelSchema } from '@/lib/validation/parcelSchema';
import type { ParcelDetail } from '@/lib/services/parcelDetail';

// The edit form's round trip: API shape → input values → payload. A field dropped anywhere
// along here saves as NULL without any error, which is the worst kind of regression — it
// looks like it worked.

const detail = (over: Partial<ParcelDetail> = {}): ParcelDetail =>
  ({
    id: '00000000-0000-4000-8000-000000000009',
    trackingNum: 'P123',
    trackingNum2: '',
    userId: '00000000-0000-4000-8000-000000000001',
    userLabel: 'Beridze, Nino / GZ1',
    tripDate: '2026-07-20',
    service: 'Regular',
    awb: '',
    contents: 'Books',
    store: 'Amazon',
    weight: 4.5,
    value: 120,
    length: null,
    width: null,
    high: null,
    dimWeight: null,
    debt: 45.5,
    location: '',
    groupId: '1',
    notes: 'Fragile',
    officeId: '',
    status: 'Shipped',
    isPaid: false,
    pcode: 'C1',
    payMethod1: '',
    payAmount1: null,
    payMethod2: '',
    payAmount2: null,
    receiver: {
      receiverId: '00000000-0000-4000-8000-000000000002',
      isGeCitizen: true,
      firstName: 'Giorgi',
      lastName: 'Kapanadze',
      firstNameGe: 'გიორგი',
      lastNameGe: 'კაპანაძე',
      organization: '',
      country: 'GE',
      street1: '12 Rustaveli',
      street2: '',
      city: 'Tbilisi',
      state: '',
      postalCode: '',
      phone1: '599112233',
      phone2: '',
      phone3: '01001012345',
    },
    customer: {
      firstName: 'Nino',
      lastName: 'Beridze',
      organization: '',
      country: 'US',
      street1: '',
      street2: '',
      city: 'New York',
      state: '',
      postalCode: '',
      phone1: '212',
      phone2: '',
    },
    trackingReceived: '2026-07-12',
    trackingReceivedBy: '',
    trackingAway: '',
    trackingEstDelivery: '',
    trackingEstShip: '',
    trackingShipped: '2026-07-20',
    trackingDelay: '',
    trackingCustom: '',
    trackingProcessingCustom: '',
    trackingOffice: '',
    trackingSendRegion: '',
    trackingOutDelivery: '',
    trackingDeliveredSigned: '',
    trackingDeliveredSignedBy: '',
    ...over,
  }) as ParcelDetail;

describe('parcelDetailToForm', () => {
  test('numbers become the strings the inputs hold, and null becomes empty', () => {
    const form = parcelDetailToForm(detail());
    expect(form.weight).toBe('4.5');
    expect(form.debt).toBe('45.5');
    expect(form.length).toBe('');
  });

  test('the paid/unpaid actions are never pre-checked — they are actions, not state', () => {
    const form = parcelDetailToForm(detail({ isPaid: true }));
    expect(form.markPaid).toBe(false);
    expect(form.markUnpaid).toBe(false);
  });

  test('a parcel with no receiver yet gets an empty receiverId, not null', () => {
    const form = parcelDetailToForm(detail({ receiver: { ...detail().receiver, receiverId: null } }));
    expect(form.receiver.receiverId).toBe('');
  });
});

describe('notesRequired', () => {
  const original = detail();

  test('false when neither weight nor amount changed', () => {
    expect(notesRequired(parcelDetailToForm(original), original)).toBe(false);
  });

  test('true when the weight changed', () => {
    const form = { ...parcelDetailToForm(original), weight: '9.5' };
    expect(notesRequired(form, original)).toBe(true);
  });

  test('true when the amount changed', () => {
    const form = { ...parcelDetailToForm(original), debt: '58' };
    expect(notesRequired(form, original)).toBe(true);
  });

  test('unrelated edits do not demand a note', () => {
    const form = { ...parcelDetailToForm(original), store: 'eBay' };
    expect(notesRequired(form, original)).toBe(false);
  });
});

describe('parcelFormToPayload', () => {
  test('an untouched form round-trips through the server schema unchanged', () => {
    const original = detail();
    const payload = parcelFormToPayload(parcelDetailToForm(original), original);
    const parsed = updateParcelSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.trackingNum).toBe('P123');
    expect(parsed.data.weight).toBe(4.5);
    expect(parsed.data.debt).toBe(45.5);
    expect(parsed.data.receiver.city).toBe('Tbilisi');
    expect(parsed.data.receiver.isGeCitizen).toBe(true);
    expect(parsed.data.customer.city).toBe('New York');
    expect(parsed.data.trackingShipped).toBe('2026-07-20');
  });

  test('an empty receiverId is sent as null so the server creates a new receiver', () => {
    const original = detail();
    const form = {
      ...parcelDetailToForm(original),
      receiver: { ...parcelDetailToForm(original).receiver, receiverId: '' },
    };
    expect(parcelFormToPayload(form, original).receiver.receiverId).toBeNull();
  });

  test('notesRequired is computed against the loaded parcel, not taken from the client', () => {
    const original = detail();
    const form = { ...parcelDetailToForm(original), weight: '9.5' };
    expect(parcelFormToPayload(form, original).notesRequired).toBe(true);
  });
});
