import { describe, expect, it } from 'bun:test';
import {
  computeRowDisplay,
  sortPayments,
  accumulateTotals,
  type RowDisplayInput,
} from '@/lib/services/parcelSalesReport';

// Pure-function coverage for "Parcels Reports 2"'s per-row view logic and money totals. The
// query itself (the NULL-exclusion filters, the `latestValueName` subquery) is exercised
// against a real database for the same reason as the sibling report's tests — see
// parcelReports.test.ts's header comment.

function baseInput(overrides: Partial<RowDisplayInput> = {}): RowDisplayInput {
  return {
    payMethod1: 'Cash',
    payMethod2: null,
    payAmount1: 50,
    payAmount2: 0,
    onlineSource: null,
    debt: 50,
    eventPayMethod: 'Cash',
    latestValueName: 'Paid',
    ...overrides,
  };
}

describe('computeRowDisplay', () => {
  it('renders a plain cash payment: Paid = pay_amount1, Debt = debt - pay_amount1', () => {
    const result = computeRowDisplay(baseInput());
    expect(result.paidAmount).toBe(50);
    expect(result.paidClass).toBe('Cash');
    expect(result.paymentType).toBe('Cash');
    expect(result.debt).toBe(0);
  });

  it('overrides pay_method1 with OnlineSource for Authorize.net/PayPal collections', () => {
    const result = computeRowDisplay(
      baseInput({ payMethod1: 'CreditCard', onlineSource: 'PayPal', eventPayMethod: 'PayPal' }),
    );
    expect(result.paymentType).toBe('PayPal');
    expect(result.paidClass).toBe('PayPal');
  });

  it('appends "US" to Payment Type for a plain CreditCard method', () => {
    const result = computeRowDisplay(baseInput({ payMethod1: 'CreditCard', eventPayMethod: 'CreditCard' }));
    expect(result.paymentType).toBe('CreditCard US');
  });

  it('includes payMethod2 in Payment Type, parenthesized', () => {
    const result = computeRowDisplay(baseInput({ payMethod2: 'Cash GE', payAmount2: 10 }));
    expect(result.paymentType).toBe('Cash (Cash GE)');
    // payMethod2 wins as the "Paid" CSS-equivalent class over pmshow, same as legacy.
    expect(result.paidClass).toBe('Cash GE');
  });

  it(
    'column "Paid" blanks a Debt-financed slot to null — not 0 — so a fully debt-financed ' +
      '"Paid" parcel falls through to the debt-amount fallback',
    () => {
      const result = computeRowDisplay(
        baseInput({
          payMethod1: 'Debt',
          payAmount1: 0,
          payMethod2: 'Debt',
          payAmount2: 0,
          debt: 75,
          latestValueName: 'Paid',
        }),
      );
      expect(result.paidAmount).toBe(75); // the fallback: `debt`, not null/blank.
    },
  );

  it(
    'column "Paid" renders nothing (null) when both slots are debt-financed and the parcel ' +
      "isn't (yet) the parcel's latest Paid event",
    () => {
      const result = computeRowDisplay(
        baseInput({ payMethod1: 'Debt', payAmount1: 0, payMethod2: 'Debt', payAmount2: 0, latestValueName: 'Unpaid' }),
      );
      expect(result.paidAmount).toBeNull();
    },
  );

  it(
    'column "Debt" zeros (not blanks) a Debt-financed slot, so it is always reachable — ' +
      'unlike column "Paid", a fully debt-financed parcel here is just `debt - 0 - 0`',
    () => {
      const result = computeRowDisplay(
        baseInput({
          payMethod1: 'Debt',
          payAmount1: 0,
          payMethod2: 'Debt',
          payAmount2: 0,
          debt: 75,
          latestValueName: 'Paid',
        }),
      );
      expect(result.debt).toBe(75);
    },
  );

  it('pmshow prefers the event\'s own "balance" method over the parcel\'s pay_method1', () => {
    const result = computeRowDisplay(baseInput({ payMethod1: 'Cash', eventPayMethod: 'balance' }));
    expect(result.paymentType).toBe('balance');
  });

  it('a plain "Debt" pmshow renders no Payment Type text on its own', () => {
    const result = computeRowDisplay(baseInput({ payMethod1: 'Debt', payAmount1: 0, eventPayMethod: 'Debt' }));
    expect(result.paymentType).toBe('');
  });
});

describe('sortPayments', () => {
  it('routes "CreditCard GE" to ccGe before falling through to the plain "card" bucket', () => {
    const totals = {
      cashUs: 0,
      cashGe: 0,
      ccUs: 0,
      ccGe: 0,
      check: 0,
      deposit: 0,
      authorize: 0,
      paypal: 0,
      balance: 0,
    };
    sortPayments(20, 'CreditCard GE', totals);
    expect(totals.ccGe).toBe(20);
    expect(totals.ccUs).toBe(0);
  });

  it('drops a method matching no bucket (e.g. a bare "PayPal" payMethod) silently', () => {
    const totals = {
      cashUs: 0,
      cashGe: 0,
      ccUs: 0,
      ccGe: 0,
      check: 0,
      deposit: 0,
      authorize: 0,
      paypal: 0,
      balance: 0,
    };
    sortPayments(20, 'PayPal', totals);
    expect(Object.values(totals).every((v) => v === 0)).toBe(true);
  });

  it('ignores a zero amount and a "Debt" method', () => {
    const totals = {
      cashUs: 0,
      cashGe: 0,
      ccUs: 0,
      ccGe: 0,
      check: 0,
      deposit: 0,
      authorize: 0,
      paypal: 0,
      balance: 0,
    };
    sortPayments(0, 'Cash', totals);
    sortPayments(20, 'Debt', totals);
    expect(Object.values(totals).every((v) => v === 0)).toBe(true);
  });
});

describe('accumulateTotals', () => {
  it("reads the event's own pay_amount, not the parcel's pay_amount1", () => {
    const rows = [{ parcelId: 'p1', payMethod: 'Cash', payAmount: 30, parcel: { onlineSource: null } }];
    const totals = accumulateTotals(rows, new Map([['p1', 'Paid']]));
    expect(totals.cashUs).toBe(30);
  });

  it('flips the sign for a parcel whose latest event is "Unpaid"', () => {
    const rows = [{ parcelId: 'p1', payMethod: 'Cash', payAmount: 30, parcel: { onlineSource: null } }];
    const totals = accumulateTotals(rows, new Map([['p1', 'Unpaid']]));
    expect(totals.cashUs).toBe(-30);
  });

  it('routes Authorize.net/PayPal collections by OnlineSource, bypassing the method buckets', () => {
    const rows = [
      { parcelId: 'p1', payMethod: 'CreditCard', payAmount: 10, parcel: { onlineSource: 'Authorize.net' } },
      { parcelId: 'p2', payMethod: 'CreditCard', payAmount: 5, parcel: { onlineSource: 'PayPal' } },
    ];
    const totals = accumulateTotals(
      rows,
      new Map([
        ['p1', 'Paid'],
        ['p2', 'Paid'],
      ]),
    );
    expect(totals.authorize).toBe(10);
    expect(totals.paypal).toBe(5);
    expect(totals.ccUs).toBe(0);
  });

  it('routes a "balance"/"Deposit" event payMethod to its own bucket', () => {
    const rows = [
      { parcelId: 'p1', payMethod: 'balance', payAmount: 12, parcel: { onlineSource: null } },
      { parcelId: 'p2', payMethod: 'Deposit', payAmount: 8, parcel: { onlineSource: null } },
    ];
    const totals = accumulateTotals(
      rows,
      new Map([
        ['p1', 'Paid'],
        ['p2', 'Paid'],
      ]),
    );
    expect(totals.balance).toBe(12);
    expect(totals.deposit).toBe(8);
  });
});
