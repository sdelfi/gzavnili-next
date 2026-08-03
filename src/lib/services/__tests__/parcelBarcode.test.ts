import { describe, expect, test } from 'bun:test';
import { generateCode128Png, generateQrPng } from '../parcelBarcode';

describe('parcelBarcode', () => {
  test('generateCode128Png returns a PNG buffer', async () => {
    const png = await generateCode128Png('DR-US1234567890', 50);
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });

  test('generateQrPng returns a PNG buffer', async () => {
    const png = await generateQrPng('DR-US1234567890', 150);
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });
});
