'use client';

import { Suspense } from 'react';
import { MessagesListPage } from '@/components/admin/messages/MessagesListPage';

export default function BemaMessagesPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <MessagesListPage />
    </Suspense>
  );
}
