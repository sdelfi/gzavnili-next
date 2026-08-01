import { describe, expect, it } from 'bun:test';
import { moneyCollectQuerySchema } from '@/lib/validation/moneyCollectSchema';

const dates = { dateStart: '2025-08-01', dateEnd: '2026-08-01' };

describe('moneyCollectQuerySchema', () => {
  it('accepts a missing country as All', () => {
    expect(moneyCollectQuerySchema.parse(dates).country).toBeUndefined();
  });

  it('normalizes legacy country= to All', () => {
    expect(moneyCollectQuerySchema.parse({ ...dates, country: '' }).country).toBeUndefined();
  });

  it('accepts the two country filters and rejects unknown values', () => {
    expect(moneyCollectQuerySchema.parse({ ...dates, country: 'us' }).country).toBe('us');
    expect(moneyCollectQuerySchema.parse({ ...dates, country: 'ge' }).country).toBe('ge');
    expect(moneyCollectQuerySchema.safeParse({ ...dates, country: 'ca' }).success).toBe(false);
  });
});
