import { describe, expect, test } from 'bun:test';
import { dedupeSmsBatch } from '../smsBatch';

describe('dedupeSmsBatch', () => {
  test('groups exact-matching texts, comma-joining their phones', () => {
    const result = dedupeSmsBatch([
      { phone: '995500000001', text: 'Hello' },
      { phone: '995500000002', text: 'Hello' },
      { phone: '995500000003', text: 'Bye' },
    ]);
    expect(result).toEqual([
      { text: 'Hello', phones: '995500000001,995500000002' },
      { text: 'Bye', phones: '995500000003' },
    ]);
  });

  test('a single differing character makes two distinct groups', () => {
    const result = dedupeSmsBatch([
      { phone: '1', text: 'Hello ' },
      { phone: '2', text: 'Hello' },
    ]);
    expect(result).toHaveLength(2);
  });

  test('empty input yields no groups', () => {
    expect(dedupeSmsBatch([])).toEqual([]);
  });
});
