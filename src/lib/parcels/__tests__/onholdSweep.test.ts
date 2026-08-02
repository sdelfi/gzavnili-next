import { describe, expect, test } from 'bun:test';
import { startsWithPDR } from '../onholdSweep';

describe('startsWithPDR', () => {
  test('matches a tracking number starting with P, D, or R', () => {
    expect(startsWithPDR('P123456')).toBe(true);
    expect(startsWithPDR('D123456')).toBe(true);
    expect(startsWithPDR('R123456')).toBe(true);
  });

  test('does not match any other prefix', () => {
    expect(startsWithPDR('GE123456')).toBe(false);
    expect(startsWithPDR('995123456')).toBe(false);
  });

  test('null/empty is not a match', () => {
    expect(startsWithPDR(null)).toBe(false);
    expect(startsWithPDR('')).toBe(false);
  });
});
