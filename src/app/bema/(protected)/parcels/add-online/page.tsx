'use client';

import { Suspense } from 'react';
import { ParcelOnlineAddPage } from '@/components/admin/parcels/ParcelOnlineAddPage';

export default function BemaParcelOnlineAddPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <ParcelOnlineAddPage />
    </Suspense>
  );
}
