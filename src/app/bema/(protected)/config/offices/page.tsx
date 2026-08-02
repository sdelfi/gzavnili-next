'use client';

import { Suspense } from 'react';
import { DeliveryOfficeListPage } from '@/components/admin/DeliveryOfficeListPage';

export default function BemaDeliveryOfficesPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <DeliveryOfficeListPage />
    </Suspense>
  );
}
