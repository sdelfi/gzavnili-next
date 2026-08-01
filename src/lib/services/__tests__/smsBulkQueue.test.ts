import { describe, expect, test } from 'bun:test';
import { BULK_SMS_STATUS_FILTER, resolveBulkSmsTargets } from '../smsBulkQueue';

// `sms_add_bulk.cfm`'s candidate-resolution logic — see
// docs/decisions/0025-bema-send-bulk-sms.md.

type Candidate = Parameters<typeof resolveBulkSmsTargets>[0][number];

function candidate(over: {
  notifyViaSms?: boolean;
  customerCountry?: string | null;
  customerPhone?: string | null;
  receiverCountry?: string | null;
  receiverPhone?: string | null;
  noReceiver?: boolean;
}): Candidate {
  return {
    userId: 'u1',
    receiverId: over.noReceiver ? null : 'r1',
    user: {
      notifyViaSms: over.notifyViaSms ?? true,
      billingAddress: { cellPhone: over.customerPhone ?? '', country: over.customerCountry ?? null },
    },
    receiver: over.noReceiver
      ? null
      : { address: { cellPhone: over.receiverPhone ?? '', country: over.receiverCountry ?? null } },
  } as unknown as Candidate;
}

describe('resolveBulkSmsTargets', () => {
  test('customer with notifyViaSms and a GE billing address gets queued as GE', () => {
    const result = resolveBulkSmsTargets(
      [candidate({ customerCountry: 'GE', customerPhone: '555123456', noReceiver: true })],
      ['customer'],
      'hi',
    );
    expect(result).toEqual([{ phone: '995555123456', text: 'hi', phoneType: 'GE' }]);
  });

  test('customer with notifyViaSms = false is skipped even when "customer" is selected', () => {
    const result = resolveBulkSmsTargets(
      [candidate({ notifyViaSms: false, customerCountry: 'GE', customerPhone: '555123456', noReceiver: true })],
      ['customer'],
      'hi',
    );
    expect(result).toEqual([]);
  });

  test('customer country other than GE/US is skipped (no else branch in legacy)', () => {
    const result = resolveBulkSmsTargets(
      [candidate({ customerCountry: 'FR', customerPhone: '555123456', noReceiver: true })],
      ['customer'],
      'hi',
    );
    expect(result).toEqual([]);
  });

  test('receiver with GE country is queued but tagged phoneType "US" — legacy bug, reproduced', () => {
    const result = resolveBulkSmsTargets(
      [candidate({ receiverCountry: 'GE', receiverPhone: '555123456' })],
      ['receiver'],
      'hi',
    );
    expect(result).toEqual([{ phone: '995555123456', text: 'hi', phoneType: 'US' }]);
  });

  test('receiver with US country is queued as US (no bug on this branch)', () => {
    const result = resolveBulkSmsTargets(
      [candidate({ receiverCountry: 'US', receiverPhone: '5551234567' })],
      ['receiver'],
      'hi',
    );
    expect(result).toEqual([{ phone: '+15551234567', text: 'hi', phoneType: 'US' }]);
  });

  test('a customer and a receiver sharing the same formatted phone are only queued once', () => {
    const result = resolveBulkSmsTargets(
      [
        candidate({
          customerCountry: 'GE',
          customerPhone: '555123456',
          receiverCountry: 'GE',
          receiverPhone: '555123456',
        }),
      ],
      ['customer', 'receiver'],
      'hi',
    );
    expect(result).toHaveLength(1);
    expect(result[0].phone).toBe('995555123456');
  });

  test('only the selected sendTo legs are resolved', () => {
    const parcel = candidate({ customerCountry: 'GE', customerPhone: '555123456', receiverCountry: 'US', receiverPhone: '5551234567' });
    expect(resolveBulkSmsTargets([parcel], ['customer'], 'hi')).toEqual([
      { phone: '995555123456', text: 'hi', phoneType: 'GE' },
    ]);
    expect(resolveBulkSmsTargets([parcel], ['receiver'], 'hi')).toEqual([
      { phone: '+15551234567', text: 'hi', phoneType: 'US' },
    ]);
  });

  test('an invalid (unformattable) phone number is skipped', () => {
    const result = resolveBulkSmsTargets(
      [candidate({ customerCountry: 'GE', customerPhone: '123', noReceiver: true })],
      ['customer'],
      'hi',
    );
    expect(result).toEqual([]);
  });
});

describe('BULK_SMS_STATUS_FILTER', () => {
  test('every dropdown value except "paid" maps to a real ParcelStatus', () => {
    expect(BULK_SMS_STATUS_FILTER.OnHold).toBe('OnHold');
    expect(BULK_SMS_STATUS_FILTER.NotOnHold).toBe('NotOnHold');
    expect(BULK_SMS_STATUS_FILTER.office).toBe('Office');
    expect(BULK_SMS_STATUS_FILTER.custom).toBe('Custom');
    expect(BULK_SMS_STATUS_FILTER.outdelivery).toBe('OutDelivery');
    expect(BULK_SMS_STATUS_FILTER.Delay).toBe('Delay');
    expect(BULK_SMS_STATUS_FILTER.received).toBe('Received');
    expect(BULK_SMS_STATUS_FILTER.awaiting).toBe('Awaiting');
    expect(BULK_SMS_STATUS_FILTER.region).toBe('Region');
    expect(BULK_SMS_STATUS_FILTER.shipped).toBe('Shipped');
  });

  test('"paid" has no mapping — legacy\'s own CASE never produces it either', () => {
    expect(BULK_SMS_STATUS_FILTER.paid).toBeUndefined();
  });
});
