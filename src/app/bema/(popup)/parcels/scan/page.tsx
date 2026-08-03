'use client';

import { Suspense } from 'react';
import { ParcelScanPage } from '@/components/admin/parcels/ParcelScanPage';

export default function BemaParcelScanPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <ParcelScanPage />
    </Suspense>
  );
}
