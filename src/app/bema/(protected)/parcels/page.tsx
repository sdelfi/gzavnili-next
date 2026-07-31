'use client';

import { Suspense } from 'react';
import { ParcelListPage } from '@/components/admin/parcels/ParcelListPage';

// `ParcelListPage` reads its filters from the URL via `useSearchParams`, which needs a
// Suspense boundary — same as the other bema list screens.
export default function ParcelsPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <ParcelListPage />
    </Suspense>
  );
}
