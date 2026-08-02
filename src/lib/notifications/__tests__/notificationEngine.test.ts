import { describe, expect, test } from 'bun:test';
import { diffDays, formatDate, formatYYMMDD } from '../notificationEngine';

describe('formatDate', () => {
  test('mm/dd/yyyy, matching legacy DateFormat()\'s default mask', () => {
    expect(formatDate(new Date('2026-01-05T12:00:00Z'))).toBe('01/05/2026');
  });

  test('null/undefined format to an empty string, not a literal "null"', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
  });
});

describe('formatYYMMDD', () => {
  test('2-digit year + zero-padded month/day', () => {
    expect(formatYYMMDD(new Date('2026-08-02T00:00:00Z'))).toBe('260802');
  });
});

describe('diffDays', () => {
  test('whole-day difference between two dates', () => {
    expect(diffDays(new Date('2026-08-01T00:00:00Z'), new Date('2026-08-05T00:00:00Z'))).toBe(4);
  });

  test('reversed order yields a negative difference', () => {
    expect(diffDays(new Date('2026-08-05T00:00:00Z'), new Date('2026-08-01T00:00:00Z'))).toBe(-4);
  });
});
