'use client';

import { Field } from '@/components/ui/admin/Field';
import { Input } from '@/components/ui/admin/Input';
import type { ParcelFormState } from '@/lib/parcels/form';
import s from './ParcelCustomerSection.module.css';

// "Customer Info" — the sender's own name and billing address, editable here. Ported from
// the fieldset of the same name in views/parcels/vwParcelsUpdate.cfm.
//
// Worth being explicit about, because it surprises people: these fields are the *customer
// record*, not a copy on the parcel. Saving the parcel saves them, so correcting a typo here
// corrects it on the account and on every other parcel that shows it. Legacy does exactly
// this (`userDao.update(user)` + `saveBillingDefault()` inside the parcel save) and
// operators rely on it — a parcel arriving with a better phone number than the account has
// is the normal way that account gets fixed. The banner in the UI says so rather than
// leaving it to be discovered.

export function ParcelCustomerSection({
  form,
  setCustomer,
  disabled,
}: {
  form: ParcelFormState;
  setCustomer: <K extends keyof ParcelFormState['customer']>(key: K, value: ParcelFormState['customer'][K]) => void;
  /** No customer chosen yet — legacy greys the whole block out in that state. */
  disabled: boolean;
}) {
  return (
    <fieldset className={s.section} disabled={disabled}>
      <legend className={s.legend}>Customer Info</legend>

      <p className={s.notice}>Saved to the customer account, not just this parcel.</p>

      <div className={s.grid}>
        <Field label="First Name:" htmlFor="customer-firstname">
          <Input
            id="customer-firstname"
            value={form.customer.firstName}
            onChange={(e) => setCustomer('firstName', e.target.value)}
          />
        </Field>
        <Field label="Last Name:" htmlFor="customer-lastname">
          <Input
            id="customer-lastname"
            value={form.customer.lastName}
            onChange={(e) => setCustomer('lastName', e.target.value)}
          />
        </Field>
        <Field label="Organization:" htmlFor="customer-organization" width="lg">
          <Input
            id="customer-organization"
            value={form.customer.organization}
            onChange={(e) => setCustomer('organization', e.target.value)}
          />
        </Field>
        <Field label="Country:" htmlFor="customer-country">
          <Input
            id="customer-country"
            value={form.customer.country}
            maxLength={2}
            onChange={(e) => setCustomer('country', e.target.value.toUpperCase())}
          />
        </Field>
        <Field label="Address:" htmlFor="customer-street1" width="lg">
          <Input
            id="customer-street1"
            value={form.customer.street1}
            onChange={(e) => setCustomer('street1', e.target.value)}
          />
        </Field>
        <Field label="Address 2:" htmlFor="customer-street2" width="lg">
          <Input
            id="customer-street2"
            value={form.customer.street2}
            onChange={(e) => setCustomer('street2', e.target.value)}
          />
        </Field>
        <Field label="City:" htmlFor="customer-city">
          <Input id="customer-city" value={form.customer.city} onChange={(e) => setCustomer('city', e.target.value)} />
        </Field>
        <Field label="State:" htmlFor="customer-state">
          <Input
            id="customer-state"
            value={form.customer.state}
            onChange={(e) => setCustomer('state', e.target.value)}
          />
        </Field>
        <Field label="Postal Code:" htmlFor="customer-postalcode">
          <Input
            id="customer-postalcode"
            value={form.customer.postalCode}
            onChange={(e) => setCustomer('postalCode', e.target.value)}
          />
        </Field>
        <Field label="Phone (1):" htmlFor="customer-phone1">
          <Input
            id="customer-phone1"
            value={form.customer.phone1}
            onChange={(e) => setCustomer('phone1', e.target.value)}
          />
        </Field>
        <Field label="Phone (2):" htmlFor="customer-phone2">
          <Input
            id="customer-phone2"
            value={form.customer.phone2}
            onChange={(e) => setCustomer('phone2', e.target.value)}
          />
        </Field>
      </div>
    </fieldset>
  );
}
