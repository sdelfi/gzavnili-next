'use client';

import { use } from 'react';
import { MessageViewPage } from '@/components/admin/messages/MessageViewPage';

export default function BemaMessageViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <MessageViewPage id={Number(id)} />;
}
