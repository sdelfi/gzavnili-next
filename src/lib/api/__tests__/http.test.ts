import { describe, expect, test } from 'bun:test';
import { extractErrorMessages } from '../http';

describe('extractErrorMessages', () => {
  test('uses a human label when one is supplied', () => {
    expect(
      extractErrorMessages(
        { error: { formErrors: [], fieldErrors: { paymentMethod1: ['Select payment method'] } } },
        { paymentMethod1: 'Payment method 1' },
      ),
    ).toEqual(['Payment method 1: Select payment method']);
  });

  test('does not expose an unknown internal field path', () => {
    expect(
      extractErrorMessages({
        error: {
          formErrors: [],
          fieldErrors: { 'draftParcels.0.receiver.postalCode': ['Receiver Postal Code is required.'] },
        },
      }),
    ).toEqual(['Receiver Postal Code is required.']);
  });
});
