import { NextRequest, NextResponse } from 'next/server';
import { requireBemaSession } from '@/lib/auth/session';
import { generateCode128Png } from '@/lib/services/parcelBarcode';

// Shared image endpoint backing "View Parcel", "Print Labels", and "Scan" — the three legacy
// screens whose barcode was always `<cfimage>`-rendered inline, without a dedicated URL of its
// own. Reproduced here as a standalone `<img src>` target instead, since a Next.js page can't
// stream a raw image the way a `.cfm` response could. Gated the union of what those three
// screens' own page-level gates allow: `BemaAdministrator`/`BemaAgent` — see
// docs/decisions/0029-parcels-barcode-print.md.
const BARCODE_ROLES = ['BemaAdministrator', 'BemaAgent'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireBemaSession(request, [...BARCODE_ROLES]);
  if (auth.response) return auth.response;

  const text = request.nextUrl.searchParams.get('text') ?? '';
  if (!text) return NextResponse.json({ error: 'text is required.' }, { status: 400 });

  const heightParam = request.nextUrl.searchParams.get('height');
  const height = heightParam ? Number(heightParam) : undefined;

  const png = await generateCode128Png(text, height);
  return new NextResponse(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
  });
}
