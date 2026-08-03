'use client';

import { Suspense } from 'react';
import { SystemEmailsPage } from '@/components/admin/SystemEmailsPage';

export default function BemaSystemEmailsPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <SystemEmailsPage />
    </Suspense>
  );
}
