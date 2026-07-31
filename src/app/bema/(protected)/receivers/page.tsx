'use client';

import { Suspense } from 'react';
import { ReceiverListPage } from '@/components/admin/receivers/ReceiverListPage';

export default function ReceiversPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <ReceiverListPage />
    </Suspense>
  );
}
