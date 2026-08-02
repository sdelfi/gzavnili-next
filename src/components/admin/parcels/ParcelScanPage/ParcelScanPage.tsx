'use client';

import { useSearchParams } from 'next/navigation';
import { PageHeading } from '@/components/ui/admin/PageHeading';
import { parcelBarcodeUrl } from '@/lib/api/bema/parcels';

// bema "Scan" popup (`bema/parcels/parcels-scan.cfm`) — a bare Code128 rendering of whatever
// text the caller passes (a parcel's `pcode`, or a tracking number), opened in a small
// `window.open(...)` popup for physically scanning or eyeballing the code off the screen. See
// docs/decisions/0029-parcels-barcode-print.md.
export function ParcelScanPage() {
  const searchParams = useSearchParams();
  const toScan = searchParams.get('toscan') ?? '';

  return (
    <div>
      <PageHeading>Scan</PageHeading>
      {toScan && <img src={parcelBarcodeUrl(toScan, 50)} alt={toScan} />}
    </div>
  );
}
