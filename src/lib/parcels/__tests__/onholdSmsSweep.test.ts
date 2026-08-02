import { describe, expect, test } from 'bun:test';
import { computeLocalStatus } from '../onholdSmsSweep';

function parcel(overrides: Partial<Parameters<typeof computeLocalStatus>[0]> = {}) {
  return {
    trackingDeliveredSigned: null,
    trackingOutDelivery: null,
    trackingOffice: null,
    trackingCustom: null,
    trackingDelay: null,
    trackingShipped: null,
    trackingReceived: null,
    trackingAway: null,
    ...overrides,
  };
}

describe('computeLocalStatus', () => {
  test('no milestones set yields New', () => {
    expect(computeLocalStatus(parcel())).toBe('New');
  });

  test('delivered wins over every other milestone, even if also shipped', () => {
    expect(
      computeLocalStatus(parcel({ trackingDeliveredSigned: new Date(), trackingShipped: new Date() })),
    ).toBe('delivered');
  });

  test('custom wins over shipped, matching the precedence order (not a timeline)', () => {
    expect(computeLocalStatus(parcel({ trackingCustom: new Date(), trackingShipped: new Date() }))).toBe(
      'custom',
    );
  });

  test('shipped alone is reported as shipped', () => {
    expect(computeLocalStatus(parcel({ trackingShipped: new Date() }))).toBe('shipped');
  });
});
