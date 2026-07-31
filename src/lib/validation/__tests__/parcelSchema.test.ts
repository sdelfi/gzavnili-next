import { describe, expect, test } from 'bun:test';
import { listParcelsQuerySchema, parcelOperationSchema, updateParcelSchema } from '../parcelSchema';
import { flattenIssues } from '../zodErrors';

const UUID = '00000000-0000-4000-8000-000000000001';

/** A payload that passes, so each test can break exactly one thing. */
const validParcel = (over: Record<string, unknown> = {}) => ({
  trackingNum: 'P123',
  userId: UUID,
  tripDate: '2026-07-20',
  service: 'Regular',
  weight: '4.5',
  value: '120',
  receiver: { city: 'Tbilisi', country: 'GE', phone1: '599112233', firstName: 'Giorgi', lastName: 'Kapanadze' },
  customer: {},
  ...over,
});

describe('listParcelsQuerySchema', () => {
  test('fills in the defaults the list relies on', () => {
    const parsed = listParcelsQuerySchema.parse({});
    expect(parsed).toMatchObject({ page: 1, perPage: 25, sort: 'Created', dir: 'desc' });
  });

  test('an unknown sort falls back rather than erroring, as legacy did', () => {
    expect(listParcelsQuerySchema.parse({ sort: 'DROP TABLE' }).sort).toBe('Created');
  });

  test('perPage is capped so a URL cannot ask for the whole table', () => {
    expect(listParcelsQuerySchema.safeParse({ perPage: '100000' }).success).toBe(false);
  });

  test('a malformed date is rejected rather than silently ignored', () => {
    expect(listParcelsQuerySchema.safeParse({ tripDate: '20/07/2026' }).success).toBe(false);
    expect(listParcelsQuerySchema.parse({ tripDate: '' }).tripDate).toBe('');
  });
});

describe('parcelOperationSchema', () => {
  test('requires at least one parcel', () => {
    expect(parcelOperationSchema.safeParse({ operation: 'delete', parcelIds: [] }).success).toBe(false);
  });

  test('paid requires a payment method', () => {
    expect(parcelOperationSchema.safeParse({ operation: 'paid', parcelIds: [UUID] }).success).toBe(false);
    expect(
      parcelOperationSchema.safeParse({ operation: 'paid', parcelIds: [UUID], payMethod1: 'Cash GE' }).success,
    ).toBe(true);
  });

  test('awb requires a code and change_code requires a code', () => {
    expect(parcelOperationSchema.safeParse({ operation: 'awb', parcelIds: [UUID] }).success).toBe(false);
    expect(parcelOperationSchema.safeParse({ operation: 'change_code', parcelIds: [UUID] }).success).toBe(false);
  });

  test('an unknown operation is rejected', () => {
    expect(parcelOperationSchema.safeParse({ operation: 'drop_everything', parcelIds: [UUID] }).success).toBe(false);
  });
});

describe('updateParcelSchema', () => {
  test('accepts a well-formed payload and coerces money to numbers', () => {
    const parsed = updateParcelSchema.parse(validParcel());
    expect(parsed.weight).toBe(4.5);
    expect(parsed.debt).toBeNull();
  });

  test('weight and value are required — legacy refuses to save without them', () => {
    expect(updateParcelSchema.safeParse(validParcel({ weight: '' })).success).toBe(false);
    expect(updateParcelSchema.safeParse(validParcel({ value: '' })).success).toBe(false);
  });

  test('a Georgian citizen must have the Georgian name pair, not the Latin one', () => {
    const geOnly = validParcel({
      receiver: { city: 'Tbilisi', country: 'GE', phone1: '1', isGeCitizen: true, firstNameGe: 'გ', lastNameGe: 'კ' },
    });
    expect(updateParcelSchema.safeParse(geOnly).success).toBe(true);

    const geMissing = validParcel({
      receiver: { city: 'Tbilisi', country: 'GE', phone1: '1', isGeCitizen: true, firstName: 'G', lastName: 'K' },
    });
    expect(updateParcelSchema.safeParse(geMissing).success).toBe(false);
  });

  test('state and postal code are demanded only for US addresses', () => {
    const ge = validParcel({
      receiver: { city: 'Tbilisi', country: 'GE', phone1: '1', firstName: 'G', lastName: 'K' },
    });
    expect(updateParcelSchema.safeParse(ge).success).toBe(true);

    const us = validParcel({ receiver: { city: 'NY', country: 'US', phone1: '1', firstName: 'G', lastName: 'K' } });
    expect(updateParcelSchema.safeParse(us).success).toBe(false);

    const usComplete = validParcel({
      receiver: {
        city: 'NY',
        country: 'US',
        phone1: '1',
        firstName: 'G',
        lastName: 'K',
        state: 'NY',
        postalCode: '10001',
      },
    });
    expect(updateParcelSchema.safeParse(usComplete).success).toBe(true);
  });

  test('a malformed US zip is rejected', () => {
    const bad = validParcel({
      receiver: {
        city: 'NY',
        country: 'US',
        phone1: '1',
        firstName: 'G',
        lastName: 'K',
        state: 'NY',
        postalCode: 'ABCDE',
      },
    });
    expect(updateParcelSchema.safeParse(bad).success).toBe(false);
  });

  test('changing weight or amount requires a note', () => {
    expect(updateParcelSchema.safeParse(validParcel({ notesRequired: true })).success).toBe(false);
    expect(updateParcelSchema.safeParse(validParcel({ notesRequired: true, notes: 'Reweighed' })).success).toBe(true);
  });

  test('marking paid requires a payment method', () => {
    expect(updateParcelSchema.safeParse(validParcel({ markPaid: true })).success).toBe(false);
    expect(updateParcelSchema.safeParse(validParcel({ markPaid: true, payMethod1: 'Cash GE' })).success).toBe(true);
  });

  test('a partial payment requires its own method', () => {
    expect(updateParcelSchema.safeParse(validParcel({ payAmount2: '10' })).success).toBe(false);
    expect(updateParcelSchema.safeParse(validParcel({ payAmount2: '10', payMethod2: 'Cash GE' })).success).toBe(true);
  });
});

describe('flattenIssues', () => {
  test('keys nested issues by their dotted path so the form can mark the right field', () => {
    const result = updateParcelSchema.safeParse(validParcel({ receiver: { country: 'GE' } }));
    expect(result.success).toBe(false);
    if (result.success) return;

    const { fieldErrors } = flattenIssues(result.error);
    expect(Object.keys(fieldErrors)).toContain('receiver.city');
    expect(Object.keys(fieldErrors)).toContain('receiver.phone1');
    expect(fieldErrors['receiver.city']?.[0]).toBe('Receiver City is required.');
  });
});
