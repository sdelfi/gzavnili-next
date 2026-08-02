'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DeliveryOfficeForm } from '@/components/admin/DeliveryOfficeForm';
import { PageHeading } from '@/components/ui/admin/PageHeading';

function NewDeliveryOfficeInner() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? undefined;
  return (
    <div>
      <PageHeading>Add Delivery Office</PageHeading>
      <DeliveryOfficeForm returnTo={returnTo} />
    </div>
  );
}

export default function NewBemaDeliveryOfficePage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <NewDeliveryOfficeInner />
    </Suspense>
  );
}
