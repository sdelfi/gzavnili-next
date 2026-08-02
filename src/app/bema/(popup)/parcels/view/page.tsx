'use client';

import { Suspense } from 'react';
import { ParcelViewPage } from '@/components/admin/parcels/ParcelViewPage';

export default function BemaParcelViewPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <ParcelViewPage />
    </Suspense>
  );
}
