'use client';

import { Suspense } from 'react';
import { PageListPage } from '@/components/admin/pages/PageListPage';

export default function BemaPagesPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <PageListPage />
    </Suspense>
  );
}
