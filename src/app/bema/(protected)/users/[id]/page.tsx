'use client';

import { use, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { UserForm, type UserFormValues } from '@/components/admin/users/UserForm';
import type { AdminRole } from '@/generated/prisma/client';

type UserRecord = UserFormValues & { id: string; accountType: 'BemaUser' | 'Customer'; adminRole: AdminRole | null };

export default function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [user, setUser] = useState<UserRecord | null>(null);
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

  return (
    <div>
      <h1>Edit {user.accountType === 'BemaUser' ? 'BEMA User' : 'Customer'}</h1>
      <UserForm accountType={user.accountType} initialValues={user} userId={user.id} />
    </div>
  );
}
