'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ReceiverForm } from '@/components/admin/receivers/ReceiverForm';
import { PageHeading } from '@/components/ui/PageHeading';

function NewReceiverPageInner() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? undefined;
  return (
    <div>
      <PageHeading>Add Receiver</PageHeading>
      <ReceiverForm returnTo={returnTo} />
    </div>
  );
}

export default function NewReceiverPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <NewReceiverPageInner />
    </Suspense>
  );
}
