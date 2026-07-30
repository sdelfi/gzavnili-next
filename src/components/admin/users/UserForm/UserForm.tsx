'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { ErrorList } from '@/components/ui/Alert';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { routes } from '@/lib/routes';
import type { AdminRole } from '@/generated/prisma/client';
import { AddressFields, EMPTY_ADDRESS, type AddressFormValues } from '../AddressFields';
import { PricingRulesSection } from '../PricingRulesSection';
import s from './UserForm.module.css';

const ROLE_OPTIONS: { value: AdminRole; label: string }[] = [
  { value: 'BemaStandard', label: 'BEMA Standard User' },
  { value: 'BemaAdministrator', label: 'BEMA Administrator' },
  { value: 'BemaAgent', label: 'BEMA Agent' },
];

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'ge', label: 'Georgian' },
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
  importId: string;
  balanceAdjust: string;
  notifyViaMail: boolean;
  notifyViaSms: boolean;
  notificationMessageTypeKeys: string[];
  language: 'en' | 'ge';
  billingAddress: AddressFormValues;
  shippingAddress: AddressFormValues;
};

// Shared create/edit form for both BEMA admin accounts and customer accounts — mirrors the
// legacy `vwUserEditForm.cfm`'s `<cfif form.typeid eq 1>`-gated fields (role radio,
// suffix), conditionally rendered here the same way based on `accountType`. Password is
// required on create, optional on edit (blank = leave unchanged) — matches the legacy
// masked-placeholder behavior in `user_edit.cfm`. Full field parity with the legacy screen
// — see docs/decisions/0011-bema-admin.md's update on this — including Import Id, Balance
// Adjust, notification-channel + per-event checkboxes, Email Language, and both
// Billing/Shipping address blocks. Pricing Rules (Customer accounts only) is its own
// sub-component since it manages its own async CRUD against a nested API resource.
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
    importId: initialValues?.importId ?? '',
    balanceAdjust: initialValues?.balanceAdjust ?? '0',
    notifyViaMail: initialValues?.notifyViaMail ?? true,
    notifyViaSms: initialValues?.notifyViaSms ?? false,
    notificationMessageTypeKeys: initialValues?.notificationMessageTypeKeys ?? [],
    language: initialValues?.language ?? 'en',
    billingAddress: initialValues?.billingAddress ?? EMPTY_ADDRESS,
    shippingAddress: initialValues?.shippingAddress ?? EMPTY_ADDRESS,
  });
  const [passwordVerify, setPasswordVerify] = useState('');
  const [messageTypes, setMessageTypes] = useState<{ key: string; label: string }[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/bema/message-types', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : { messageTypes: [] }))
      .then((data) => setMessageTypes(data.messageTypes));
  }, []);

  function set<K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function toggleMessageType(key: string) {
    setValues((prev) => ({
      ...prev,
      notificationMessageTypeKeys: prev.notificationMessageTypeKeys.includes(key)
        ? prev.notificationMessageTypeKeys.filter((k) => k !== key)
        : [...prev.notificationMessageTypeKeys, key],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);

    if (values.password && values.password !== passwordVerify) {
      setErrors(['Password and Verify Password must match.']);
      return;
    }

    setSubmitting(true);
    const { password, balanceAdjust, ...rest } = values;
    const payload = {
      ...rest,
      accountType,
      balanceAdjust: Number(balanceAdjust) || 0,
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

      <CollapsibleSection title="Account Information">
        <div className={s.grid}>
          <label className={s.field}>
            Username
            <Input value={values.username} onChange={(e) => set('username', e.target.value)} required />
          </label>
          <label className={s.field}>
            Import Id
            <Input value={values.importId} onChange={(e) => set('importId', e.target.value)} />
          </label>

          <label className={s.field}>
            Password
            <Input
              type="password"
              value={values.password}
              onChange={(e) => set('password', e.target.value)}
              required={!userId}
            />
            {userId && <span className={s.hint}>Leave blank to keep current password</span>}
          </label>
          <label className={s.field}>
            Balance Adjust
            <Input
              type="number"
              step="0.01"
              value={values.balanceAdjust}
              onChange={(e) => set('balanceAdjust', e.target.value)}
            />
          </label>

          <label className={s.field}>
            Verify Password
            <Input type="password" value={passwordVerify} onChange={(e) => setPasswordVerify(e.target.value)} />
          </label>
          <div className={s.field}>
            Email Language
            <Select
              instanceId="user-form-language"
              options={LANGUAGE_OPTIONS}
              value={values.language}
              onChange={(v) => set('language', v as 'en' | 'ge')}
            />
          </div>

          <label className={s.field}>
            Email
            <Input type="email" value={values.email} onChange={(e) => set('email', e.target.value)} required />
          </label>
        </div>

        <div className={s.checkboxRow}>
          <span className={s.groupLabel}>Status:</span>
          <label className={s.checkbox}>
            <input type="checkbox" checked={values.active} onChange={(e) => set('active', e.target.checked)} />
            Active
          </label>
          <label className={s.checkbox}>
            <input type="checkbox" checked={values.confirmed} onChange={(e) => set('confirmed', e.target.checked)} />
            Email Confirmed
          </label>
        </div>

        <div className={s.checkboxRow}>
          <span className={s.groupLabel}>Notification Type:</span>
          <label className={s.checkbox}>
            <input
              type="checkbox"
              checked={values.notifyViaMail}
              onChange={(e) => set('notifyViaMail', e.target.checked)}
            />
            Via mail
          </label>
          <label className={s.checkbox}>
            <input
              type="checkbox"
              checked={values.notifyViaSms}
              onChange={(e) => set('notifyViaSms', e.target.checked)}
            />
            Via SMS
          </label>
        </div>

        <div>
          <span className={s.groupLabel}>Notification Type:</span>
          <div className={s.messageTypeGrid}>
            {messageTypes.map((type) => (
              <label key={type.key} className={s.checkbox}>
                <input
                  type="checkbox"
                  checked={values.notificationMessageTypeKeys.includes(type.key)}
                  onChange={() => toggleMessageType(type.key)}
                />
                {type.label}
              </label>
            ))}
          </div>
        </div>

        {accountType === 'BemaUser' && (
          <div className={s.grid}>
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
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Contact Information">
        <AddressFields
          heading="Billing Address"
          instanceIdPrefix="billing"
          value={values.billingAddress}
          onChange={(v) => set('billingAddress', v)}
        />
        <AddressFields
          heading="Shipping Address"
          instanceIdPrefix="shipping"
          value={values.shippingAddress}
          onChange={(v) => set('shippingAddress', v)}
          showEmail
        />
      </CollapsibleSection>

      <div className={s.actions}>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="warning" onClick={() => router.push(routes.bema.users({ accountType }))}>
          Cancel
        </Button>
      </div>

      {userId && accountType === 'Customer' && <PricingRulesSection userId={userId} />}
    </form>
  );
}
