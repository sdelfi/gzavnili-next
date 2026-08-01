import { describe, expect, it } from 'bun:test';
import { formatUpdaterName, diffEntry } from '@/lib/services/parcelHistory';

// Pure-function coverage for the edit-log helpers the Parcels Reports screen depends on.
// The report aggregation itself is exercised against a real database (it is almost entirely
// query semantics — NULL handling in `<>` predicates, the BemaAgent exclusion join — which a
// mock would not reproduce faithfully); see docs/decisions/0018-parcel-edit-history.md.

describe('formatUpdaterName', () => {
  it('renders legacy `huser`: "First Last (username)"', () => {
    expect(formatUpdaterName({ firstName: 'Torn', lastName: 'Ike', username: 'tornikero' })).toBe(
      'Torn Ike (tornikero)',
    );
  });

  it('keeps the spacing when a name part is missing, as legacy string concatenation does', () => {
    // Legacy builds this as `firstName & ' ' & lastName & ' (' & username & ')'`, so two
    // empty name parts leave two spaces. Not trimmed — the string is stored, and matching
    // legacy's stored form keeps an ETL import of legacy rows consistent with new ones.
    expect(formatUpdaterName({ firstName: null, lastName: null, username: 'gzavnili' })).toBe('  (gzavnili)');
  });
});

describe('diffEntry', () => {
  it('returns null when the rendered values are equal — legacy logs nothing', () => {
    expect(diffEntry('p1', 'Received', 'Debt', '20.00', '20.00')).toBeNull();
  });

  it('logs a row when the values differ', () => {
    expect(diffEntry('p1', 'Received', 'Debt', '20.00', '25.00')).toEqual({
      parcelId: 'p1',
      editStatus: 'Received',
      valueName: 'Debt',
      oldValue: '20.00',
      newValue: '25.00',
    });
  });

  it('compares rendered strings, not numbers — `5` vs `5.00` is a change to legacy', () => {
    // Legacy compares the raw form strings (`form.tdebt neq form.debt`), so a reformat alone
    // still writes a history row. Reproduced rather than "fixed" into a numeric comparison.
    expect(diffEntry('p1', 'Received', 'Value', '5', '5.00')).not.toBeNull();
  });
});
