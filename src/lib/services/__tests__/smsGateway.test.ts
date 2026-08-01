import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { formatPhone, sendSms } from '../smsGateway';

// `messages.cfc`'s `formatphone()`/`sendsms()` port — see docs/decisions/0024-bema-send-sms.md.

describe('formatPhone', () => {
  test('GE: a 9-digit local number gets the 995 country code prepended', () => {
    expect(formatPhone('555123456', 'GE')).toBe('995555123456');
  });

  test('GE: strips non-digit formatting characters before checking length', () => {
    expect(formatPhone('(555) 123-456', 'GE')).toBe('995555123456');
  });

  test('GE: an already-12-digit number (995 prefix included) passes through unchanged', () => {
    expect(formatPhone('995555123456', 'GE')).toBe('995555123456');
  });

  test('GE: any other length is invalid', () => {
    expect(formatPhone('12345', 'GE')).toBe(0);
    expect(formatPhone('5551234567', 'GE')).toBe(0);
  });

  test('US: a 10-digit number gets +1 prepended', () => {
    expect(formatPhone('5551234567', 'US')).toBe('+15551234567');
  });

  test('US: an 11-digit number (leading 1 included) gets + prepended', () => {
    expect(formatPhone('15551234567', 'US')).toBe('+15551234567');
  });

  test('US: any other length is invalid', () => {
    expect(formatPhone('555123', 'US')).toBe(0);
  });

  test('defaults to GE when no country given', () => {
    expect(formatPhone('555123456')).toBe('995555123456');
  });
});

describe('sendSms', () => {
  const originalFetch = global.fetch;
  const originalGeKey = process.env.SMS_GATEWAY_GE_KEY;
  const originalUsKey = process.env.SMS_GATEWAY_US_KEY;
  const originalUsFrom = process.env.SMS_GATEWAY_US_FROM;

  beforeEach(() => {
    delete process.env.SMS_GATEWAY_GE_KEY;
    delete process.env.SMS_GATEWAY_US_KEY;
    delete process.env.SMS_GATEWAY_US_FROM;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalGeKey === undefined) delete process.env.SMS_GATEWAY_GE_KEY;
    else process.env.SMS_GATEWAY_GE_KEY = originalGeKey;
    if (originalUsKey === undefined) delete process.env.SMS_GATEWAY_US_KEY;
    else process.env.SMS_GATEWAY_US_KEY = originalUsKey;
    if (originalUsFrom === undefined) delete process.env.SMS_GATEWAY_US_FROM;
    else process.env.SMS_GATEWAY_US_FROM = originalUsFrom;
  });

  test('returns the phone unchanged and does not call fetch when no gateway key is configured', async () => {
    let called = false;
    global.fetch = (() => {
      called = true;
      return Promise.resolve(new Response('ok'));
    }) as unknown as typeof fetch;

    const result = await sendSms('995555123456', 'hello', 'GE');

    expect(result).toBe('995555123456');
    expect(called).toBe(false);
  });

  test('a 995-prefixed phone always routes to the GE gateway, even when type is US', async () => {
    process.env.SMS_GATEWAY_GE_KEY = 'test-key';
    let calledUrl = '';
    global.fetch = ((url: string) => {
      calledUrl = url;
      return Promise.resolve(new Response('ok'));
    }) as unknown as typeof fetch;

    await sendSms('995555123456', 'hello', 'US');

    expect(calledUrl).toContain('smsoffice.ge');
  });

  test('a failed gateway call is swallowed — the phone is still returned', async () => {
    process.env.SMS_GATEWAY_GE_KEY = 'test-key';
    global.fetch = (() => Promise.reject(new Error('network down'))) as unknown as typeof fetch;

    const result = await sendSms('995555123456', 'hello', 'GE');

    expect(result).toBe('995555123456');
  });
});
