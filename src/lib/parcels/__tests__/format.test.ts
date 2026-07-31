import { describe, expect, test } from 'bun:test';
import { formatAmount, formatDate, formatDateTime, formatWithLari } from '../format';
import { payMethodOptions, serviceLabel } from '../constants';

describe('formatDate / formatDateTime', () => {
  test('US format in UTC, so two offices read the same number off the screen', () => {
    expect(formatDate('2026-07-20T00:00:00.000Z')).toBe('07/20/2026');
    expect(formatDateTime('2026-07-20T14:30:00.000Z')).toBe('07/20/2026 2:30 PM');
  });

  test('an unset milestone renders as empty, not "Invalid Date"', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDateTime('not a date')).toBe('');
  });
});

describe('formatAmount', () => {
  test('two decimals, but blank when there is no figure at all', () => {
    expect(formatAmount(4.5)).toBe('4.50');
    expect(formatAmount(0)).toBe('0.00');
    expect(formatAmount(null)).toBe('');
  });
});

describe('formatWithLari', () => {
  test('adds the GEL equivalent when a rate is known', () => {
    expect(formatWithLari(45.5, 2.7)).toBe('45.50 (122.85 GEL)');
    expect(formatWithLari(45.5, null)).toBe('45.50');
  });
});

describe('serviceLabel', () => {
  test('renames the three services that display differently from how they are stored', () => {
    expect(serviceLabel('Saveez')).toBe('Saveez.com');
    expect(serviceLabel('online')).toBe('Online Shopping');
    expect(serviceLabel('Economy')).toBe('Philadelphia');
    expect(serviceLabel('Regular')).toBe('Regular');
    expect(serviceLabel(null)).toBe('');
  });
});

describe('payMethodOptions', () => {
  test('a Georgia-based admin gets the GE instruments, everyone else the US ones', () => {
    const ge = payMethodOptions('GE').map((o) => o.value);
    expect(ge).toContain('Check GE');
    expect(ge).not.toContain('Cash');

    const us = payMethodOptions('US').map((o) => o.value);
    expect(us).toContain('Cash');
    expect(us).not.toContain('Check GE');
  });

  test('the shared instruments are offered to both', () => {
    for (const country of ['GE', 'US', null]) {
      const values = payMethodOptions(country).map((o) => o.value);
      expect(values).toContain('Cash GE');
      expect(values).toContain('PayPal');
      expect(values[0]).toBe('');
    }
  });
});
