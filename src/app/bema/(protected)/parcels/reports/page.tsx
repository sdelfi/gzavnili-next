'use client';

import { Suspense } from 'react';
import { ParcelsReportsPage } from '@/components/admin/parcels/ParcelsReportsPage';

export default function ParcelsReportsRoute() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <ParcelsReportsPage />
    </Suspense>
  );
}
