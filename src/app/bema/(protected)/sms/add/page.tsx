'use client';

import { Suspense } from 'react';
import { SmsAddPage } from '@/components/admin/messages/SmsAddPage';

export default function BemaSmsAddPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <SmsAddPage />
    </Suspense>
  );
}
