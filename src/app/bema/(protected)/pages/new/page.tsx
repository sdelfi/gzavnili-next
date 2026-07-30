'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageForm } from '@/components/admin/pages/PageForm';

function NewPageInner() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? undefined;
  return (
    <div>
      <h1>Add Page</h1>
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
