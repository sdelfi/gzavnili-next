'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { UserForm } from '@/components/admin/users/UserForm';
import { PageHeading } from '@/components/ui/admin/PageHeading';

function NewUserPageInner() {
  const searchParams = useSearchParams();
  const accountType = searchParams.get('accountType') === 'Customer' ? 'Customer' : 'BemaUser';
  const returnTo = searchParams.get('returnTo') ?? undefined;
  return (
    <div>
      <PageHeading>Add {accountType === 'BemaUser' ? 'BEMA User' : 'Customer'}</PageHeading>
      <UserForm accountType={accountType} returnTo={returnTo} />
    </div>
  );
}

export default function NewUserPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <NewUserPageInner />
    </Suspense>
  );
}
