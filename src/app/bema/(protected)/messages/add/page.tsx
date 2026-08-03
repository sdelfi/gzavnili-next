'use client';

import { PageHeading } from '@/components/ui/admin/PageHeading';
import { MessageComposeForm } from '@/components/admin/messages/MessageComposeForm';

export default function BemaMessageAddPage() {
  return (
    <div>
      <PageHeading>Add message</PageHeading>
      <MessageComposeForm />
    </div>
  );
}
