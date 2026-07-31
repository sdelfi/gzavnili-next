'use client';

import { Suspense } from 'react';
import { ParcelAddPage } from '@/components/admin/parcels/ParcelAddPage';

// `ParcelAddPage` reads `returnTo` from the URL via `useSearchParams`, hence the Suspense
// boundary — same as the parcel edit screen.
export default function ParcelAdd() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <ParcelAddPage />
    </Suspense>
  );
}
