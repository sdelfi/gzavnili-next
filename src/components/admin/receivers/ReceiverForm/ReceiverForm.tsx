'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
import { ErrorList } from '@/components/ui/Alert';
import { CustomerPicker } from '@/components/admin/parcels/CustomerPicker';
import { routes } from '@/lib/routes';
import { createReceiver, updateReceiver } from '@/lib/api/bema/receivers';
import { ApiError, extractErrorMessages } from '@/lib/api/http';
import s from './ReceiverForm.module.css';

const FIELD_LABELS: Record<string, string> = {
  userId: 'Customer',
  firstName: 'First Name',
  lastName: 'Last Name',
  city: 'City',
  country: 'Country',
  state: 'State',
  postalCode: 'Postal Code',
  phone1: 'Phone (1)',
};

export type ReceiverFormValues = {
  userId: string;
  customerLabel: string;
  active: boolean;
  isGeCitizen: boolean;
  firstName: string;
  lastName: string;
  firstNameGe: string;
  lastNameGe: string;
  organization: string;
  country: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  postalCode: string;
  phone1: string;
  phone2: string;
  phone3: string;
};

const EMPTY_VALUES: ReceiverFormValues = {
  userId: '',
  customerLabel: '',
  active: true,
  isGeCitizen: false,
  firstName: '',
  lastName: '',
  firstNameGe: '',
  lastNameGe: '',
  organization: '',
  country: '',
  street1: '',
  street2: '',
  city: '',
  state: '',
  postalCode: '',
  phone1: '',
  phone2: '',
  phone3: '',
};

// The standalone Receivers admin screen's add/edit form — legacy `vwReceiversUpdate.cfm`.
// Field set matches `ParcelReceiverSection` (the parcel form's inline receiver picker/editor)
// since both edit the same `Receiver`/`Address` shape, but this one owns which customer the
// receiver belongs to (via `CustomerPicker`, legacy's `userid` dropdown) and its Active flag
// (legacy's soft-delete), neither of which the parcel-form fieldset needs.
export function ReceiverForm({
  initialValues,
  receiverId,
  returnTo,
}: {
  initialValues?: Partial<ReceiverFormValues>;
  /** Present when editing an existing receiver; absent when creating one. */
  receiverId?: string;
  returnTo?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ReceiverFormValues>({ ...EMPTY_VALUES, ...initialValues });
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof ReceiverFormValues>(key: K, value: ReceiverFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const backTo = () => returnTo || routes.bema.receivers();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    setSubmitting(true);

    const payload = {
      userId: values.userId,
      active: values.active,
      isGeCitizen: values.isGeCitizen,
      firstName: values.firstName,
      lastName: values.lastName,
      firstNameGe: values.firstNameGe,
      lastNameGe: values.lastNameGe,
      organization: values.organization,
      country: values.country,
      street1: values.street1,
      street2: values.street2,
      city: values.city,
      state: values.state,
      postalCode: values.postalCode,
      phone1: values.phone1,
      phone2: values.phone2,
      phone3: values.phone3,
    };

    try {
      if (receiverId) {
        await updateReceiver(receiverId, payload);
      } else {
        await createReceiver(payload);
      }
      router.push(backTo());
    } catch (err) {
      setErrors(err instanceof ApiError ? extractErrorMessages(err.body, FIELD_LABELS) : ['Save failed.']);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  }

  const isGe = values.isGeCitizen;

  return (
    <form className={s.form} onSubmit={handleSubmit}>
      <ErrorList errors={errors} />

      <div className={s.customerField}>
        <Field label="Customer:">
          <CustomerPicker
            value={values.userId}
            label={values.customerLabel}
            onChange={(customer) => {
              set('userId', customer.id);
              set('customerLabel', customer.label);
            }}
          />
        </Field>
      </div>

      <div className={s.grid}>
        <Field label=" ">
          <Checkbox label="Active" checked={values.active} onChange={(e) => set('active', e.target.checked)} />
        </Field>
        <Field label=" ">
          <Checkbox
            label="Is Georgian Citizen?"
            checked={isGe}
            onChange={(e) => set('isGeCitizen', e.target.checked)}
          />
        </Field>

        <Field label={isGe ? 'First Name (Latin):' : 'First Name:'} htmlFor="receiver-firstname">
          <Input id="receiver-firstname" value={values.firstName} onChange={(e) => set('firstName', e.target.value)} />
        </Field>
        <Field label={isGe ? 'Last Name (Latin):' : 'Last Name:'} htmlFor="receiver-lastname">
          <Input id="receiver-lastname" value={values.lastName} onChange={(e) => set('lastName', e.target.value)} />
        </Field>

        <Field label="First Name (GE):" htmlFor="receiver-firstnamege">
          <Input
            id="receiver-firstnamege"
            value={values.firstNameGe}
            onChange={(e) => set('firstNameGe', e.target.value)}
          />
        </Field>
        <Field label="Last Name (GE):" htmlFor="receiver-lastnamege">
          <Input
            id="receiver-lastnamege"
            value={values.lastNameGe}
            onChange={(e) => set('lastNameGe', e.target.value)}
          />
        </Field>

        <Field label="Organization:" htmlFor="receiver-organization" width="lg">
          <Input
            id="receiver-organization"
            value={values.organization}
            onChange={(e) => set('organization', e.target.value)}
          />
        </Field>

        <Field label="Country:" htmlFor="receiver-country">
          <Input
            id="receiver-country"
            value={values.country}
            maxLength={2}
            placeholder="GE"
            onChange={(e) => set('country', e.target.value.toUpperCase())}
          />
        </Field>

        <Field label="Address:" htmlFor="receiver-street1" width="lg">
          <Input id="receiver-street1" value={values.street1} onChange={(e) => set('street1', e.target.value)} />
        </Field>
        <Field label="Address 2:" htmlFor="receiver-street2" width="lg">
          <Input id="receiver-street2" value={values.street2} onChange={(e) => set('street2', e.target.value)} />
        </Field>

        <Field label="City:" htmlFor="receiver-city">
          <Input id="receiver-city" value={values.city} onChange={(e) => set('city', e.target.value)} />
        </Field>
        <Field label="State:" htmlFor="receiver-state">
          <Input id="receiver-state" value={values.state} onChange={(e) => set('state', e.target.value)} />
        </Field>
        <Field label="Postal Code:" htmlFor="receiver-postalcode">
          <Input id="receiver-postalcode" value={values.postalCode} onChange={(e) => set('postalCode', e.target.value)} />
        </Field>

        <Field label="Phone (1):" htmlFor="receiver-phone1">
          <Input id="receiver-phone1" value={values.phone1} onChange={(e) => set('phone1', e.target.value)} />
        </Field>
        <Field label="Phone (2):" htmlFor="receiver-phone2">
          <Input id="receiver-phone2" value={values.phone2} onChange={(e) => set('phone2', e.target.value)} />
        </Field>
        <Field label="Private #:" htmlFor="receiver-phone3">
          <Input id="receiver-phone3" value={values.phone3} onChange={(e) => set('phone3', e.target.value)} />
        </Field>
      </div>

      <div className={s.actions}>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="warning" onClick={() => router.push(backTo())}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
