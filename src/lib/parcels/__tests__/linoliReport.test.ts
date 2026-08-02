import { describe, expect, test } from 'bun:test';
import { buildLinoliCsv, type LinoliRow } from '../linoliReport';

function row(overrides: Partial<LinoliRow> = {}): LinoliRow {
  return {
    receiverFirstName: 'Jane',
    receiverLastName: 'Doe',
    username: 'GZ20001',
    city: 'Tbilisi',
    street1: '1 Main St',
    street2: 'Vake',
    phone1: '995500000000',
    phone2: null,
    phone3: null,
    trackingNum: 'T123',
    store: 'Personal',
    debt: 10,
    isPaid: false,
    weight: 2.5,
    value: 100,
    contents: 'Clothes',
    ...overrides,
  };
}

describe('buildLinoliCsv', () => {
  test('header line matches legacy\'s column list', () => {
    const csv = buildLinoliCsv([]);
    expect(csv).toBe(
      'FIRST NAME,LAST NAME,USERNAME,CITY,ADDRESS,UBANY,PHONE,PHONE2,PRIVATE NUMBER,TRACKING #,STORE NAME,DEBT,PAID,WEIGHT,VALUE,PARCEL CONTENT',
    );
  });

  test('unpaid debt renders in DEBT, a bare "0" in PAID', () => {
    const csv = buildLinoliCsv([row({ debt: 10, isPaid: false })]);
    const cells = csv.split('\n')[1].split(',');
    expect(cells[11]).toBe('10.00');
    expect(cells[12]).toBe('0');
  });

  test('paid debt renders "0." in DEBT (trailing dot, no digits), the amount in PAID', () => {
    const csv = buildLinoliCsv([row({ debt: 10, isPaid: true })]);
    const cells = csv.split('\n')[1].split(',');
    expect(cells[11]).toBe('0.');
    expect(cells[12]).toBe('10.00');
  });

  test('blank receiver name renders a single space, not an empty cell', () => {
    const csv = buildLinoliCsv([row({ receiverFirstName: null, receiverLastName: null })]);
    const cells = csv.split('\n')[1].split(',');
    expect(cells[0]).toBe(' ');
    expect(cells[1]).toBe(' ');
  });

  test('tracking number is Excel-formula-wrapped', () => {
    const csv = buildLinoliCsv([row({ trackingNum: 'T999' })]);
    expect(csv.split('\n')[1]).toContain('="T999"');
  });
});
