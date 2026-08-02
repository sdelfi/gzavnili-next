import { NextRequest, NextResponse } from 'next/server';
import { requireBemaSession } from '@/lib/auth/session';
import { generateQrPng } from '@/lib/services/parcelBarcode';

// QR-code counterpart to `barcode/route.ts` — only "Print Labels" ever actually renders one
// (see docs/decisions/0029-parcels-barcode-print.md), but gated the same role set for
// consistency with the other barcode/image endpoints.
const QRCODE_ROLES = ['BemaAdministrator', 'BemaAgent'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...QRCODE_ROLES]);
  if (auth.response) return auth.response;

  const text = request.nextUrl.searchParams.get('text') ?? '';
  if (!text) return NextResponse.json({ error: 'text is required.' }, { status: 400 });

  const widthParam = request.nextUrl.searchParams.get('width');
  const width = widthParam ? Number(widthParam) : undefined;

  const png = await generateQrPng(text, width);
  return new NextResponse(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
  });
}
