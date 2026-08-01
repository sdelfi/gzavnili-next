'use client';

import { Suspense } from 'react';
import { ParcelsSalesReportPage } from '@/components/admin/parcels/ParcelsSalesReportPage';

export default function ParcelsSalesReportRoute() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <ParcelsSalesReportPage />
    </Suspense>
  );
}
