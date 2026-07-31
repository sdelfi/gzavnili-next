import { describe, expect, test } from 'bun:test';
import {
  computeDraftParcelTotals,
  computeGroupIncrease,
  finalDebt,
  priceOverrideScale,
  type DraftParcelCalcInput,
} from '../batchPricing';

// The batch "Add Parcel" screen's group-fee/minimum-charge/payment-split math — the part the
// client explicitly flagged as needing careful, exact porting from parcels-add.js.

const item = (over: Partial<DraftParcelCalcInput> = {}): DraftParcelCalcInput => ({
  id: 'p1',
  groupId: '1',
  delivery: 'Pickup',
  service: 'Regular',
  weight: 1,
  ...over,
});

describe('computeGroupIncrease', () => {
  test('Pickup adds nothing beyond the minimum charge', () => {
    expect(computeGroupIncrease(5, 20, 'Pickup')).toBe(0);
  });

  test('Delivery adds a flat $5 for the whole group', () => {
    expect(computeGroupIncrease(5, 20, 'Delivery')).toBe(5);
  });

  test('Region adds $5 per started 10kg tier of the group weight', () => {
    expect(computeGroupIncrease(10, 20, 'Region')).toBe(5);
    expect(computeGroupIncrease(10.1, 20, 'Region')).toBe(10);
    expect(computeGroupIncrease(25, 20, 'Region')).toBe(15);
  });

  test('a group under $5 tops up to the minimum, on top of any delivery fee', () => {
    expect(computeGroupIncrease(1, 3, 'Pickup')).toBe(2);
    // Delivery's flat fee and the minimum-charge top-up stack — both keyed off the
    // *pre-fee* group amount, not off each other. A quirk found in the legacy source and
    // preserved rather than "fixed".
    expect(computeGroupIncrease(1, 3, 'Delivery')).toBe(5 + 2);
  });

  test('a group already at or above $5 gets no top-up', () => {
    expect(computeGroupIncrease(1, 5, 'Pickup')).toBe(0);
    expect(computeGroupIncrease(1, 10, 'Pickup')).toBe(0);
  });
});

describe('computeDraftParcelTotals', () => {
  test('single Regular/Pickup parcel: base rate only, no group fee', () => {
    // Regular's default schedule rate is $8/kg (pricing.ts's `defaultPrice()` — note that's
    // its own hardcoded 8, distinct from `DEFAULT_REGULAR_RATE` (9) used elsewhere for other
    // services' fallback); 2kg is well over the $5 minimum on its own.
    const { items, groups, grandTotal } = computeDraftParcelTotals([item({ weight: 2 })], []);
    expect(items).toEqual([{ id: 'p1', baseDebt: 16, increase: 0, rawTotal: 16 }]);
    expect(groups).toEqual([{ groupId: '1', weight: 2, amount: 16 }]);
    expect(grandTotal).toEqual({ weight: 2, amount: 16 });
  });

  test('Delivery group fee is split evenly across the group\'s parcels', () => {
    const items: DraftParcelCalcInput[] = [
      item({ id: 'a', delivery: 'Delivery', weight: 1 }),
      item({ id: 'b', delivery: 'Delivery', weight: 1 }),
    ];
    // Each parcel: 1kg * $8 = $8 (well above the $5 minimum) -> group base = $16, +$5 delivery
    // fee = $21, split $2.50 each.
    const { items: results, groups } = computeDraftParcelTotals(items, []);
    expect(results.find((r) => r.id === 'a')).toEqual({ id: 'a', baseDebt: 8, increase: 2.5, rawTotal: 10.5 });
    expect(results.find((r) => r.id === 'b')).toEqual({ id: 'b', baseDebt: 8, increase: 2.5, rawTotal: 10.5 });
    expect(groups).toEqual([{ groupId: '1', weight: 2, amount: 21 }]);
  });

  test('separate groups are priced independently', () => {
    const items: DraftParcelCalcInput[] = [
      item({ id: 'a', groupId: '1', weight: 2 }),
      item({ id: 'b', groupId: '2', delivery: 'Delivery', weight: 1 }),
    ];
    const { groups, grandTotal } = computeDraftParcelTotals(items, []);
    expect(groups).toEqual([
      { groupId: '1', weight: 2, amount: 16 },
      { groupId: '2', weight: 1, amount: 13 }, // 8 + 5 delivery fee
    ]);
    expect(grandTotal).toEqual({ weight: 3, amount: 29 });
  });

  test('a low-value group is topped up to the $5 minimum before splitting', () => {
    // Express is $7/kg on the default schedule (pricing.ts's `defaultPrice()` 'Express' case).
    // Use a tiny weight so the base falls under the $5 minimum.
    const items: DraftParcelCalcInput[] = [item({ service: 'Express', weight: 0.1 })];
    const { items: results, groups } = computeDraftParcelTotals(items, []);
    // baseDebt = 0.1 * 7 = 0.7; top-up = 5 - 0.7 = 4.3; final = 5.
    expect(results[0].baseDebt).toBeCloseTo(0.7, 2);
    expect(results[0].increase).toBeCloseTo(4.3, 2);
    expect(results[0].rawTotal).toBeCloseTo(5, 2);
    expect(groups[0].amount).toBe(5);
  });
});

describe('priceOverrideScale / finalDebt', () => {
  test('blank or matching override is a no-op', () => {
    expect(priceOverrideScale(100, null)).toBe(1);
    expect(priceOverrideScale(100, 100)).toBe(1);
    expect(finalDebt(40, 1)).toBe(40);
  });

  test('a different Price Total scales every parcel proportionally', () => {
    const scale = priceOverrideScale(100, 80);
    expect(scale).toBe(0.8);
    expect(finalDebt(40, scale)).toBe(32);
  });

  test('a zero raw total never divides by zero', () => {
    expect(priceOverrideScale(0, 50)).toBe(1);
  });
});
