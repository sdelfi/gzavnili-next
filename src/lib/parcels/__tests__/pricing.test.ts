import { describe, expect, test } from 'bun:test';
import { calculateParcelPrice, dimensionalWeight, type PricingRule } from '../pricing';

// The price the parcel form suggests. Money: a regression here is a wrong invoice.

const rule = (over: Partial<PricingRule> = {}): PricingRule => ({
  id: 'r1',
  serviceType: 'Regular',
  mode: 'FixedPrice',
  value: 6,
  validFrom: '2020-01-01T00:00:00.000Z',
  validTo: null,
  notes: null,
  isActive: true,
  ...over,
});

const NOW = new Date('2026-07-20T12:00:00.000Z');

describe('dimensionalWeight', () => {
  test('L x W x H / 366, legacy divisor', () => {
    expect(dimensionalWeight(40, 30, 30)).toBeCloseTo(98.36, 2);
    expect(dimensionalWeight(0, 30, 30)).toBe(0);
  });
});

describe('calculateParcelPrice — default schedule', () => {
  const price = (service: string, weight: number, dimWeight = 0) =>
    calculateParcelPrice({ service, weight, dimWeight, rules: [], now: NOW }).amount;

  test('Regular is a flat 8/kg', () => expect(price('Regular', 4.5)).toBe(36));
  test('Express and Philadelphia are 7/kg', () => {
    expect(price('Express', 10)).toBe(70);
    expect(price('Economy', 10)).toBe(70);
  });
  test('Online is 8/kg up to 7kg and 7/kg above', () => {
    expect(price('Online', 7)).toBe(56);
    expect(price('Online', 8)).toBe(56);
  });
  test('Saveez is 5.85/kg on scale weight, 5.50 when dimensional weight rules', () => {
    expect(price('saveez', 10)).toBeCloseTo(58.5, 2);
    expect(price('saveez', 10, 20)).toBeCloseTo(110, 2);
  });
  test('an unknown service falls back to the per-service default rate', () => {
    expect(price('Cargo', 10)).toBe(85);
  });
});

describe('calculateParcelPrice — billable weight', () => {
  test('the larger of scale and dimensional weight is charged', () => {
    const result = calculateParcelPrice({ service: 'Regular', weight: 5, dimWeight: 20, rules: [], now: NOW });
    expect(result.amount).toBe(160);
    expect(result.explanation).toContain('dimensional weight');
  });

  test('a smaller dimensional weight is ignored, and not mentioned', () => {
    const result = calculateParcelPrice({ service: 'Regular', weight: 20, dimWeight: 5, rules: [], now: NOW });
    expect(result.amount).toBe(160);
    expect(result.explanation).not.toContain('dimensional');
  });
});

describe('calculateParcelPrice — customer rules', () => {
  test('a fixed-price rule replaces the rate', () => {
    const result = calculateParcelPrice({ service: 'Regular', weight: 10, dimWeight: 0, rules: [rule()], now: NOW });
    expect(result.amount).toBe(60);
    expect(result.explanation).toContain('Custom rate');
  });

  test('a discount rule takes a percentage off the base rate', () => {
    const result = calculateParcelPrice({
      service: 'Regular',
      weight: 10,
      dimWeight: 0,
      rules: [rule({ mode: 'Discount', value: 10 })],
      now: NOW,
    });
    // Base for Regular is 9.00/kg, so 10kg - 10% = 81.
    expect(result.amount).toBeCloseTo(81, 2);
  });

  test('a rule for another service does not apply', () => {
    const result = calculateParcelPrice({
      service: 'Express',
      weight: 10,
      dimWeight: 0,
      rules: [rule({ serviceType: 'Regular' })],
      now: NOW,
    });
    expect(result.amount).toBe(70);
  });

  test('a rule that has not started yet does not apply', () => {
    const result = calculateParcelPrice({
      service: 'Regular',
      weight: 10,
      dimWeight: 0,
      rules: [rule({ validFrom: '2030-01-01T00:00:00.000Z' })],
      now: NOW,
    });
    expect(result.amount).toBe(80);
  });

  test('an expired rule does not apply', () => {
    const result = calculateParcelPrice({
      service: 'Regular',
      weight: 10,
      dimWeight: 0,
      rules: [rule({ validTo: '2026-07-19T00:00:00.000Z' })],
      now: NOW,
    });
    expect(result.amount).toBe(80);
  });

  test('validTo is inclusive — a rule ending today still applies today', () => {
    const result = calculateParcelPrice({
      service: 'Regular',
      weight: 10,
      dimWeight: 0,
      rules: [rule({ validTo: '2026-07-20T00:00:00.000Z' })],
      now: NOW,
    });
    expect(result.amount).toBe(60);
  });

  test('the rule applies to the billable weight, not the scale weight', () => {
    const result = calculateParcelPrice({ service: 'Regular', weight: 5, dimWeight: 20, rules: [rule()], now: NOW });
    expect(result.amount).toBe(120);
  });
});
