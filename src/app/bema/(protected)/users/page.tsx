'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { UserListPage } from '@/components/admin/users/UserListPage';

function UsersPageInner() {
  const searchParams = useSearchParams();
  const accountType = searchParams.get('accountType') === 'Customer' ? 'Customer' : 'BemaUser';
  return <UserListPage accountType={accountType} />;
}

export default function UsersPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <UsersPageInner />
    </Suspense>
  );
}
