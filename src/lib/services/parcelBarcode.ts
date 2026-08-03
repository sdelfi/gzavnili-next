import bwipjs from 'bwip-js/node';

// Ports `extensions/components/barcodes/barcode/barcode.cfc` (Java Barbecue, `code128`
// symbology — the only one of its ~25 supported types any legacy caller ever passes) and
// `extensions/components/barcodes/barcodeQR/barcodeQR.cfc` (Java ZXing QR encoder). Both
// generated a `BufferedImage` server-side that legacy streamed back as `image/png`/`image/jpg`;
// reproduced here as PNG buffers from a single JS library (`bwip-js`) instead of two separate
// Java dependencies. Pixel-for-pixel image output cannot be, and isn't meant to be, identical
// across completely different rendering engines — what matters is the same symbology encoding
// the same text, at a comparable size. See docs/decisions/0029-parcels-barcode-print.md.

/** `barcode.cfc#createBarcode()`'s own default `barWidth=2`. `scale` here is bwip-js's
 *  pixels-per-module control — the closest equivalent. */
export async function generateCode128Png(text: string, heightPx = 50): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text,
    scale: 2,
    height: heightPx / 2,
    includetext: false,
  });
}

export async function generateQrPng(text: string, sizePx = 150): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: 'qrcode',
    text,
    scale: 2,
    width: sizePx / 2,
    height: sizePx / 2,
  });
}
