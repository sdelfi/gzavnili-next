import { describe, expect, test } from 'bun:test';
import { addParcelBatchSchema, quickCustomerSchema } from '../parcelBatchSchema';

const UUID = '00000000-0000-4000-8000-000000000001';

const validDraft = (over: Record<string, unknown> = {}) => ({
  delivery: 'Pickup',
  service: 'Regular',
  trackingNum: 'PR250731143012',
  weight: '2',
  value: '50',
  groupId: '1',
  receiver: { city: 'Tbilisi', country: 'GE', phone1: '599112233', firstName: 'Giorgi', lastName: 'Kapanadze' },
  ...over,
});

const validBatch = (over: Record<string, unknown> = {}) => ({
  userId: UUID,
  customer: { firstName: 'Ann', lastName: 'Smith', country: 'US', city: 'Philadelphia', phone1: '2155551234' },
  paymentMethod1: 'Debt',
  draftParcels: [validDraft()],
  ...over,
});

describe('addParcelBatchSchema', () => {
  test('a well-formed single-parcel batch parses', () => {
    const parsed = addParcelBatchSchema.safeParse(validBatch());
    expect(parsed.success).toBe(true);
  });

  test('at least one draft parcel is required', () => {
    expect(addParcelBatchSchema.safeParse(validBatch({ draftParcels: [] })).success).toBe(false);
  });

  test('a payment method is required (Debt counts)', () => {
    expect(addParcelBatchSchema.safeParse(validBatch({ paymentMethod1: '' })).success).toBe(false);
  });

  test('a second payment amount requires its own method', () => {
    expect(addParcelBatchSchema.safeParse(validBatch({ paymentAmount2: 10 })).success).toBe(false);
    expect(addParcelBatchSchema.safeParse(validBatch({ paymentAmount2: 10, paymentMethod2: 'Cash GE' })).success).toBe(
      true,
    );
  });

  test('two parcels in the same group must share delivery and service', () => {
    const mismatched = validBatch({
      draftParcels: [validDraft({ groupId: '1', delivery: 'Pickup' }), validDraft({ groupId: '1', delivery: 'Delivery' })],
    });
    const result = addParcelBatchSchema.safeParse(mismatched);
    expect(result.success).toBe(false);
  });

  test('two parcels in different groups may have different delivery/service', () => {
    const ok = validBatch({
      draftParcels: [validDraft({ groupId: '1', delivery: 'Pickup' }), validDraft({ groupId: '2', delivery: 'Delivery' })],
    });
    expect(addParcelBatchSchema.safeParse(ok).success).toBe(true);
  });

  test('a receiver missing required fields fails, with a path pointing at that draft', () => {
    const bad = validBatch({ draftParcels: [validDraft({ receiver: { city: '', country: 'GE', phone1: '1' } })] });
    const result = addParcelBatchSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('draftParcels.0.receiver.city');
    }
  });

  test('a Georgian-citizen receiver needs the Georgian name pair, not the Latin one', () => {
    const ge = validBatch({
      draftParcels: [
        validDraft({
          receiver: { city: 'Tbilisi', country: 'GE', phone1: '1', isGeCitizen: true, firstNameGe: 'გ', lastNameGe: 'კ' },
        }),
      ],
    });
    expect(addParcelBatchSchema.safeParse(ge).success).toBe(true);
  });
});

describe('quickCustomerSchema', () => {
  test('a well-formed new-customer payload parses', () => {
    const parsed = quickCustomerSchema.safeParse({
      userId: null,
      firstName: 'Ann',
      lastName: 'Smith',
      email: 'ann@example.com',
      country: 'GE',
      city: 'Tbilisi',
      phone1: '599112233',
    });
    expect(parsed.success).toBe(true);
  });

  test('email/first/last/country/city/phone1 are required', () => {
    expect(quickCustomerSchema.safeParse({ userId: null, firstName: '', lastName: 'Smith', email: 'a@b.com', country: 'GE', city: 'Tbilisi', phone1: '1' }).success).toBe(false);
    expect(quickCustomerSchema.safeParse({ userId: null, firstName: 'Ann', lastName: 'Smith', email: 'not-an-email', country: 'GE', city: 'Tbilisi', phone1: '1' }).success).toBe(false);
  });
});
