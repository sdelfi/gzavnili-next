import { describe, expect, test } from 'bun:test';
import { substituteTokens } from '../templateTokens';

describe('substituteTokens', () => {
  test('replaces every occurrence of each token', () => {
    const result = substituteTokens('Hi {firstname}, {firstname}!', { firstname: 'Bob' });
    expect(result).toBe('Hi Bob, Bob!');
  });

  test('a token with no matching key in the string is left untouched by other substitutions', () => {
    const result = substituteTokens('{a} and {b}', { a: '1' });
    expect(result).toBe('1 and {b}');
  });

  test('empty replacement value removes the token', () => {
    const result = substituteTokens('before{x}after', { x: '' });
    expect(result).toBe('beforeafter');
  });
});
