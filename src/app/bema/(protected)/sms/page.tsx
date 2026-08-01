'use client';

import { Suspense } from 'react';
import { SmsListPage } from '@/components/admin/messages/SmsListPage';

export default function BemaSmsPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <SmsListPage />
    </Suspense>
  );
}
