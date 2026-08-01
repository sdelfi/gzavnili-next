'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageForm } from '@/components/admin/pages/PageForm';
import { PageHeading } from '@/components/ui/admin/PageHeading';

function NewPageInner() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? undefined;
  return (
    <div>
      <PageHeading>Add Page</PageHeading>
      <PageForm returnTo={returnTo} />
    </div>
  );
}

export default function NewBemaPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <NewPageInner />
    </Suspense>
  );
}
