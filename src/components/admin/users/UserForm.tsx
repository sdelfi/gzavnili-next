'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { ErrorList } from '@/components/ui/Alert';
import { routes } from '@/lib/routes';
import type { AdminRole } from '@/generated/prisma/client';
import s from './UserForm.module.css';

const ROLE_OPTIONS: { value: AdminRole; label: string }[] = [
  { value: 'BemaStandard', label: 'BEMA Standard User' },
  { value: 'BemaAdministrator', label: 'BEMA Administrator' },
  { value: 'BemaAgent', label: 'BEMA Agent' },
];

export type UserFormValues = {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  active: boolean;
  confirmed: boolean;
  adminRole: AdminRole | null;
  suffix: string;
};

// Shared create/edit form for both BEMA admin accounts and customer accounts — mirrors the
// legacy `vwUserEditForm.cfm`'s `<cfif form.typeid eq 1>`-gated fields (role radio,
// suffix), conditionally rendered here the same way based on `accountType`. Password is
// required on create, optional on edit (blank = leave unchanged) — matches the legacy
// masked-placeholder behavior in `user_edit.cfm`. Billing/shipping address fields are
// deliberately out of scope for this pass — see PROGRESS.md.
export function UserForm({
  accountType,
  initialValues,
  userId,
}: {
  accountType: 'BemaUser' | 'Customer';
  initialValues?: Partial<UserFormValues>;
  /** Present when editing an existing user; absent when creating one. */
  userId?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<UserFormValues>({
    username: initialValues?.username ?? '',
    email: initialValues?.email ?? '',
    firstName: initialValues?.firstName ?? '',
    lastName: initialValues?.lastName ?? '',
    password: '',
    active: initialValues?.active ?? true,
    confirmed: initialValues?.confirmed ?? false,
    adminRole: initialValues?.adminRole ?? (accountType === 'BemaUser' ? 'BemaStandard' : null),
    suffix: initialValues?.suffix ?? '',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors([]);

    const { password, ...rest } = values;
    const payload = {
      ...rest,
      accountType,
      ...(password ? { password } : {}),
    };

    try {
      const res = await fetch(userId ? `/api/bema/users/${userId}` : '/api/bema/users', {
        method: userId ? 'PATCH' : 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const flat = body?.error?.formErrors ?? [];
        const fieldErrors = body?.error?.fieldErrors
          ? Object.values(body.error.fieldErrors as Record<string, string[]>).flat()
          : [];
        setErrors(flat.concat(fieldErrors).length ? flat.concat(fieldErrors) : [body?.error ?? 'Save failed.']);
        return;
      }
      router.push(routes.bema.users({ accountType }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={s.form} onSubmit={handleSubmit}>
      <ErrorList errors={errors} />

      <fieldset className={s.section}>
        <legend>Account Information</legend>

        <label className={s.field}>
          Username
          <Input value={values.username} onChange={(e) => set('username', e.target.value)} required />
        </label>
        <label className={s.field}>
          Email
          <Input type="email" value={values.email} onChange={(e) => set('email', e.target.value)} required />
        </label>
        <label className={s.field}>
          Password {userId && <span className={s.hint}>(leave blank to keep current password)</span>}
          <Input
            type="password"
            value={values.password}
            onChange={(e) => set('password', e.target.value)}
            required={!userId}
          />
        </label>
        <label className={s.field}>
          First name
          <Input value={values.firstName} onChange={(e) => set('firstName', e.target.value)} required />
        </label>
        <label className={s.field}>
          Last name
          <Input value={values.lastName} onChange={(e) => set('lastName', e.target.value)} required />
        </label>

        <label className={s.checkbox}>
          <input type="checkbox" checked={values.active} onChange={(e) => set('active', e.target.checked)} />
          Active
        </label>
        <label className={s.checkbox}>
          <input type="checkbox" checked={values.confirmed} onChange={(e) => set('confirmed', e.target.checked)} />
          Confirmed
        </label>

        {accountType === 'BemaUser' && (
          <>
            <label className={s.field}>
              Suffix
              <Input value={values.suffix} onChange={(e) => set('suffix', e.target.value)} />
            </label>
            <div className={s.field}>
              User Type
              <Select
                instanceId="user-form-role"
                options={ROLE_OPTIONS}
                value={values.adminRole ?? 'BemaStandard'}
                onChange={(value) => set('adminRole', value)}
              />
            </div>
          </>
        )}
      </fieldset>

      <div className={s.actions}>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push(routes.bema.users({ accountType }))}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
