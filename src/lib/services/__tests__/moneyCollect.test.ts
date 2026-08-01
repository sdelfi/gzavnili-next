import { describe, expect, it } from 'bun:test';
import { bucketPayMethod, accumulateGroupTotals, type GroupHistoryRow } from '@/lib/services/moneyCollect';

// Pure-function coverage for "Money Collect"'s findNoCase paymethod bucketing and per-(agent,
// day) totals loop. The query itself (grouping, the MoneyCollectHistory day-match, the
// NULL-exclusion filter) is exercised against a real database the same way the sibling
// reports' queries are.

describe('bucketPayMethod', () => {
  it('matches Cash', () => {
    expect(bucketPayMethod('Cash')).toBe('cash');
  });

  it('matches Bank Deposit via "Deposit"', () => {
    expect(bucketPayMethod('Bank Deposit')).toBe('bankDeposit');
  });

  it('checks "Card GE" before the bare "Card" bucket', () => {
    expect(bucketPayMethod('CreditCard GE')).toBe('creditCardGe');
    expect(bucketPayMethod('CreditCard')).toBe('creditCard');
  });

  it('matches Check/Authorize/Paypal/Wire', () => {
    expect(bucketPayMethod('Check')).toBe('check');
    expect(bucketPayMethod('Authorize.net')).toBe('authorize');
    expect(bucketPayMethod('PayPal')).toBe('paypal');
    expect(bucketPayMethod('Wire Transfer')).toBe('wireTransfer');
  });

  it('is case-insensitive', () => {
    expect(bucketPayMethod('cash ge')).toBe('cash');
  });

  it('returns null for a method matching none of the buckets', () => {
    expect(bucketPayMethod('Store Credit')).toBeNull();
  });
});

describe('accumulateGroupTotals', () => {
  function row(overrides: Partial<GroupHistoryRow> = {}): GroupHistoryRow {
    return { valueName: 'Paid', payMethod: 'Cash', payAmount: 50, ...overrides };
  }

  it('adds Paid rows and buckets them', () => {
    const { buckets, total } = accumulateGroupTotals([row()]);
    expect(total).toBe(50);
    expect(buckets.cash).toBe(50);
  });

  it('subtracts Unpaid rows', () => {
    const { buckets, total } = accumulateGroupTotals([row(), row({ valueName: 'Unpaid', payAmount: 20 })]);
    expect(total).toBe(30);
    expect(buckets.cash).toBe(30);
  });

  it('is a no-op for a row matched only via the payMethod1 PayPal/Authorize OR-branch (valueName neither Paid nor Unpaid)', () => {
    const { buckets, total } = accumulateGroupTotals([row({ valueName: 'Received', payAmount: 999 })]);
    expect(total).toBe(0);
    expect(buckets.cash).toBe(0);
  });

  it('sums multiple distinct payMethods into their own buckets and into the same total', () => {
    const { buckets, total } = accumulateGroupTotals([
      row({ payMethod: 'Cash', payAmount: 30 }),
      row({ payMethod: 'CreditCard GE', payAmount: 20 }),
    ]);
    expect(total).toBe(50);
    expect(buckets.cash).toBe(30);
    expect(buckets.creditCardGe).toBe(20);
  });

  it('drops an unbucketed payMethod from every bucket but keeps it in the total', () => {
    const { buckets, total } = accumulateGroupTotals([row({ payMethod: 'Store Credit', payAmount: 15 })]);
    expect(total).toBe(15);
    expect(Object.values(buckets).every((v) => v === 0)).toBe(true);
  });

  it('treats a null payMethod as unbucketed but still totals it', () => {
    const { buckets, total } = accumulateGroupTotals([row({ payMethod: null, payAmount: 10 })]);
    expect(total).toBe(10);
    expect(Object.values(buckets).every((v) => v === 0)).toBe(true);
  });
});
