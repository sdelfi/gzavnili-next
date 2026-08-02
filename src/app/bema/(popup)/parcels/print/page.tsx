'use client';

import { Suspense } from 'react';
import { ParcelPrintPage } from '@/components/admin/parcels/ParcelPrintPage';

export default function BemaParcelPrintPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <ParcelPrintPage />
    </Suspense>
  );
}
