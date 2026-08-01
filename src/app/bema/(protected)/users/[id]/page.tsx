'use client';

import { Suspense, use, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert } from '@/components/ui/admin/Alert';
import { PageHeading } from '@/components/ui/admin/PageHeading';
import { UserForm, type UserFormValues } from '@/components/admin/users/UserForm';
import { EMPTY_ADDRESS, type AddressFormValues } from '@/components/admin/users/AddressFields';
import type { AdminRole } from '@/generated/prisma/client';
import { getUser } from '@/lib/api/bema/users';

type RawAddress = Partial<Record<keyof AddressFormValues, string | null>> | null | undefined;

type RawUser = Partial<UserFormValues> & {
  id: string;
  accountType: 'BemaUser' | 'Customer';
  adminRole: AdminRole | null;
  billingAddress?: RawAddress;
  shippingAddress?: RawAddress;
  balanceAdjust?: string | number | null;
  agentPrice?: string | number | null;
};

function toAddressFormValues(address: RawAddress): AddressFormValues {
  if (!address) return EMPTY_ADDRESS;
  const result = { ...EMPTY_ADDRESS };
  for (const key of Object.keys(EMPTY_ADDRESS) as (keyof AddressFormValues)[]) {
    result[key] = address[key] ?? '';
  }
  return result;
}

function EditUserPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? undefined;
  const [user, setUser] = useState<RawUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getUser<RawUser>(id)
      .then((data) => setUser(data.user))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load user.'));
  }, [id]);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!user) return <div>Loading…</div>;

  const initialValues: Partial<UserFormValues> = {
    ...user,
    balanceAdjust: user.balanceAdjust != null ? String(user.balanceAdjust) : '0',
    agentPrice: user.agentPrice != null ? String(user.agentPrice) : '',
    billingAddress: toAddressFormValues(user.billingAddress),
    shippingAddress: toAddressFormValues(user.shippingAddress),
  };

  return (
    <div>
      <PageHeading>Edit {user.accountType === 'BemaUser' ? 'BEMA User' : 'Customer'}</PageHeading>
      <UserForm accountType={user.accountType} initialValues={initialValues} userId={user.id} returnTo={returnTo} />
    </div>
  );
}

export default function EditUserPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <EditUserPageInner {...props} />
    </Suspense>
  );
}
