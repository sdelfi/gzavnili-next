'use client';

import { use, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { UserForm, type UserFormValues } from '@/components/admin/users/UserForm';
import { EMPTY_ADDRESS, type AddressFormValues } from '@/components/admin/users/AddressFields';
import type { AdminRole } from '@/generated/prisma/client';

type RawAddress = Partial<Record<keyof AddressFormValues, string | null>> | null | undefined;

type RawUser = Partial<UserFormValues> & {
  id: string;
  accountType: 'BemaUser' | 'Customer';
  adminRole: AdminRole | null;
  billingAddress?: RawAddress;
  shippingAddress?: RawAddress;
  balanceAdjust?: string | number | null;
};

function toAddressFormValues(address: RawAddress): AddressFormValues {
  if (!address) return EMPTY_ADDRESS;
  const result = { ...EMPTY_ADDRESS };
  for (const key of Object.keys(EMPTY_ADDRESS) as (keyof AddressFormValues)[]) {
    result[key] = address[key] ?? '';
  }
  return result;
}

export default function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [user, setUser] = useState<RawUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/bema/users/${id}`, { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? 'Failed to load user.');
        }
        return res.json();
      })
      .then((data) => setUser(data.user))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load user.'));
  }, [id]);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!user) return <div>Loading…</div>;

  const initialValues: Partial<UserFormValues> = {
    ...user,
    balanceAdjust: user.balanceAdjust != null ? String(user.balanceAdjust) : '0',
    billingAddress: toAddressFormValues(user.billingAddress),
    shippingAddress: toAddressFormValues(user.shippingAddress),
  };

  return (
    <div>
      <h1>Edit {user.accountType === 'BemaUser' ? 'BEMA User' : 'Customer'}</h1>
      <UserForm accountType={user.accountType} initialValues={initialValues} userId={user.id} />
    </div>
  );
}
