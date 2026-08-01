'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/admin/Input';
import { Select } from '@/components/ui/admin/Select';
import { Button } from '@/components/ui/admin/Button';
import { ErrorList } from '@/components/ui/admin/Alert';
import { CollapsibleSection } from '@/components/ui/admin/CollapsibleSection';
import { Checkbox } from '@/components/ui/admin/Checkbox';
import { routes } from '@/lib/routes';
import type { AdminRole } from '@/generated/prisma/client';
import { createUser, listMessageTypes, updateUser } from '@/lib/api/bema/users';
import { ApiError, extractErrorMessages } from '@/lib/api/http';
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

// Maps zod field-error keys (including dotted paths like `billingAddress.firstName`)
// to human-readable labels for the top-of-form error list.
const FIELD_LABELS: Record<string, string> = {
  username: 'Username',
  email: 'Email',
  firstName: 'First Name',
  lastName: 'Last Name',
  password: 'Password',
  adminRole: 'User Type',
  suffix: 'Suffix',
  agentPrice: 'Agent Price',
  passwordShort: 'Short Password',
  importId: 'Import Id',
  balanceAdjust: 'Balance Adjust',
  language: 'Email Language',
  'billingAddress.firstName': 'Billing Address: First Name',
  'billingAddress.lastName': 'Billing Address: Last Name',
  'billingAddress.email': 'Billing Address: Email',
  'billingAddress.country': 'Billing Address: Country',
  'billingAddress.street1': 'Billing Address: Street',
  'billingAddress.city': 'Billing Address: City',
  'billingAddress.state': 'Billing Address: State',
  'billingAddress.postalCode': 'Billing Address: Postal Code',
  'shippingAddress.firstName': 'Shipping Address: First Name',
  'shippingAddress.lastName': 'Shipping Address: Last Name',
  'shippingAddress.email': 'Shipping Address: Email',
  'shippingAddress.country': 'Shipping Address: Country',
  'shippingAddress.street1': 'Shipping Address: Street',
  'shippingAddress.city': 'Shipping Address: City',
  'shippingAddress.state': 'Shipping Address: State',
  'shippingAddress.postalCode': 'Shipping Address: Postal Code',
};

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
  /** The BEMA Agent flat per-kg rate, blank for "not set" — see `prisma/schema.prisma`'s
   *  doc comment on `User.agentPrice` and docs/findings.md. */
  agentPrice: string;
  passwordShort: string;
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
  returnTo,
}: {
  accountType: 'BemaUser' | 'Customer';
  initialValues?: Partial<UserFormValues>;
  /** Present when editing an existing user; absent when creating one. */
  userId?: string;
  /** Where to navigate back to on save/cancel — the list URL (with its filter/sort/page
      state) the user came from, matching the legacy `user_edit.cfm`'s `location(form.rs)`
      redirect-back-to-where-you-came-from behavior. Falls back to a reset list. */
  returnTo?: string;
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
    agentPrice: initialValues?.agentPrice ?? '',
    passwordShort: '',
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
    listMessageTypes()
      .then((data) => setMessageTypes(data.messageTypes))
      .catch(() => setMessageTypes([]));
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);
    const { password, passwordShort, balanceAdjust, agentPrice, ...rest } = values;
    const payload = {
      ...rest,
      accountType,
      balanceAdjust: Number(balanceAdjust) || 0,
      agentPrice: agentPrice.trim() === '' ? null : Number(agentPrice),
      ...(password ? { password } : {}),
      ...(passwordShort ? { passwordShort } : {}),
    };

    try {
      if (userId) {
        await updateUser(userId, payload);
      } else {
        await createUser(payload);
      }
      router.push(returnTo || routes.bema.users({ accountType }));
    } catch (err) {
      setErrors(err instanceof ApiError ? extractErrorMessages(err.body, FIELD_LABELS) : ['Save failed.']);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
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
              First Name
              <Input value={values.firstName} onChange={(e) => set('firstName', e.target.value)} required />
            </label>
            <label className={s.field}>
              Last Name
              <Input value={values.lastName} onChange={(e) => set('lastName', e.target.value)} required />
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
            <Checkbox label="Active" checked={values.active} onChange={(e) => set('active', e.target.checked)} />
            <Checkbox
              label="Email Confirmed"
              checked={values.confirmed}
              onChange={(e) => set('confirmed', e.target.checked)}
            />
          </div>

          <div className={s.checkboxRow}>
            <span className={s.groupLabel}>Notification Type:</span>
            <Checkbox
              label="Via mail"
              checked={values.notifyViaMail}
              onChange={(e) => set('notifyViaMail', e.target.checked)}
            />
            <Checkbox
              label="Via SMS"
              checked={values.notifyViaSms}
              onChange={(e) => set('notifyViaSms', e.target.checked)}
            />
          </div>

          <div>
            <span className={s.groupLabel}>Notification Type:</span>
            <div className={s.messageTypeGrid}>
              {messageTypes.map((type) => (
                <Checkbox
                  key={type.key}
                  label={type.label}
                  checked={values.notificationMessageTypeKeys.includes(type.key)}
                  onChange={() => toggleMessageType(type.key)}
                />
              ))}
            </div>
          </div>

          {accountType === 'BemaUser' && (
            <div className={s.grid}>
              <label className={s.field}>
                Suffix
                <Input value={values.suffix} onChange={(e) => set('suffix', e.target.value)} />
              </label>
              <label className={s.field}>
                Agent Price
                <Input
                  type="number"
                  step="0.01"
                  value={values.agentPrice}
                  onChange={(e) => set('agentPrice', e.target.value)}
                />
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

              <label className={s.field}>
                Short Password
                <Input
                  type="password"
                  value={values.passwordShort}
                  onChange={(e) => set('passwordShort', e.target.value)}
                  minLength={3}
                  maxLength={15}
                />
                <span className={s.hint}>
                  {userId ? 'Leave blank to keep current short password. ' : ''}
                  Used for the idle-lock quick-unlock prompt (3–15 characters).
                </span>
              </label>
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
          <Button
            type="button"
            variant="warning"
            onClick={() => router.push(returnTo || routes.bema.users({ accountType }))}
          >
            Cancel
          </Button>
        </div>
      </form>

      {userId && accountType === 'Customer' && <PricingRulesSection userId={userId} />}
    </>
  );
}
