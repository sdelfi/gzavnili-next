'use client';

import { Suspense, use } from 'react';
import { ParcelEditPage } from '@/components/admin/parcels/ParcelEditPage';

// `ParcelEditPage` reads `returnTo` from the URL via `useSearchParams`, hence the Suspense
// boundary — same as the other bema screens.
export default function ParcelEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <ParcelEditPage parcelId={id} />
    </Suspense>
  );
}
