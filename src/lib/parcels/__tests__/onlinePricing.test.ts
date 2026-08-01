import { describe, expect, test } from 'bun:test';
import { calculateOnlineDebt, calculateOnlineDimWeight, type OnlineDebtInput } from '../onlinePricing';

// "Add Online Parcel"'s calcDebt() port — see docs/decisions/0022-parcels-online-add.md.

const base = (over: Partial<OnlineDebtInput> = {}): OnlineDebtInput => ({
  weight: 1,
  length: 0,
  width: 0,
  high: 0,
  service: 'Regular',
  declaredPrice: 4,
  nonDeclaredPrice: 6,
  pexists: false,
  hasDeclaredContentsOrValue: false,
  ...over,
});

describe('calculateOnlineDimWeight', () => {
  test('(length × width × high) / 366, rounded to 4 decimals', () => {
    expect(calculateOnlineDimWeight(10, 10, 10)).toBeCloseTo(1000 / 366, 4);
  });

  test('any missing dimension treated as 0', () => {
    expect(calculateOnlineDimWeight(10, 10, 0)).toBe(0);
  });
});

describe('calculateOnlineDebt', () => {
  test('new Regular parcel always uses nonDeclaredPrice, even with no lookup at all', () => {
    const { debt } = calculateOnlineDebt(base({ weight: 2, service: 'Regular' }));
    expect(debt).toBe(12); // 2kg * nonDeclaredPrice(6)
  });

  test('weight below 0.2kg is clamped up to 0.2kg', () => {
    const { debt } = calculateOnlineDebt(base({ weight: 0.05, nonDeclaredPrice: 6 }));
    expect(debt).toBe(1.2); // 0.2 * 6
  });

  test('invalid/blank weight is treated as 0, then clamped to the 0.2kg floor', () => {
    const { debt } = calculateOnlineDebt(base({ weight: NaN, nonDeclaredPrice: 6 }));
    expect(debt).toBe(1.2);
  });

  test('existing parcel with declared contents/value on file uses declaredPrice', () => {
    const { debt } = calculateOnlineDebt(
      base({ weight: 2, pexists: true, hasDeclaredContentsOrValue: true, declaredPrice: 4 }),
    );
    expect(debt).toBe(8); // 2kg * declaredPrice(4)
  });

  test('existing parcel with no declared contents/value still uses nonDeclaredPrice', () => {
    const { debt } = calculateOnlineDebt(
      base({ weight: 2, pexists: true, hasDeclaredContentsOrValue: false, nonDeclaredPrice: 6 }),
    );
    expect(debt).toBe(12);
  });

  test('Express is a flat 7x multiplier, ignoring declared/nonDeclared entirely', () => {
    const { debt } = calculateOnlineDebt(base({ weight: 2, service: 'Express' }));
    expect(debt).toBe(14);
  });

  test('Cargo is a flat 3.5x multiplier', () => {
    const { debt } = calculateOnlineDebt(base({ weight: 2, service: 'Cargo' }));
    expect(debt).toBe(7);
  });

  test('dimensional weight is used instead of actual weight when it is larger', () => {
    // dimWeight = 20*20*20/366 = 21.857... > actual weight (1kg)
    const { dimWeight, debt } = calculateOnlineDebt(
      base({ weight: 1, length: 20, width: 20, high: 20, nonDeclaredPrice: 6 }),
    );
    expect(dimWeight).toBeCloseTo(21.8579, 4);
    // The dim weight is re-rounded to 2 decimals (formatNumber()) before pricing, not 4 —
    // 21.86 * 6, not 21.8579 * 6. This is the legacy discrepancy, reproduced deliberately.
    expect(debt).toBe(Number((21.86 * 6).toFixed(4)));
  });

  test('dimensional weight below actual weight is ignored for pricing', () => {
    const { dimWeight, debt } = calculateOnlineDebt(base({ weight: 5, length: 1, width: 1, high: 1 }));
    expect(dimWeight).toBeCloseTo(1 / 366, 4);
    expect(debt).toBe(30); // 5kg * nonDeclaredPrice(6), dim weight (~0.0027) never wins
  });
});
