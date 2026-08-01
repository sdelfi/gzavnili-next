import { Input } from '@/components/ui/admin/Input';
import { Select } from '@/components/ui/admin/Select';
import { COUNTRIES } from '@/lib/countries';
import s from './AddressFields.module.css';

export type AddressFormValues = {
  firstName: string;
  lastName: string;
  title: string;
  organization: string;
  email: string;
  country: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  postalCode: string;
  privateNumber: string;
  cellPhone: string;
  workPhone: string;
  homePhone: string;
  fax: string;
};

export const EMPTY_ADDRESS: AddressFormValues = {
  firstName: '',
  lastName: '',
  title: '',
  organization: '',
  email: '',
  country: '',
  street1: '',
  street2: '',
  city: '',
  state: '',
  postalCode: '',
  privateNumber: '',
  cellPhone: '',
  workPhone: '',
  homePhone: '',
  fax: '',
};

// Renders one Billing- or Shipping-Address block — legacy "Edit Customer" screen's
// Contact Information section has two of these (see docs/decisions/0011-bema-admin.md).
// `showEmail`: only the shipping block has an Email field on the legacy screen.
export function AddressFields({
  heading,
  value,
  onChange,
  showEmail = false,
  instanceIdPrefix,
}: {
  heading: string;
  value: AddressFormValues;
  onChange: (value: AddressFormValues) => void;
  showEmail?: boolean;
  instanceIdPrefix: string;
}) {
  function set<K extends keyof AddressFormValues>(key: K, v: AddressFormValues[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className={s.block}>
      <h3 className={s.heading}>{heading}</h3>
      <div className={s.grid}>
        <label className={s.field}>
          First Name
          <Input value={value.firstName} onChange={(e) => set('firstName', e.target.value)} />
        </label>
        <label className={s.field}>
          Private Number
          <Input value={value.privateNumber} onChange={(e) => set('privateNumber', e.target.value)} />
        </label>

        <label className={s.field}>
          Last Name
          <Input value={value.lastName} onChange={(e) => set('lastName', e.target.value)} />
        </label>
        <label className={s.field}>
          Cell Phone
          <Input value={value.cellPhone} onChange={(e) => set('cellPhone', e.target.value)} />
        </label>

        {showEmail && (
          <>
            <label className={s.field}>
              Email
              <Input type="email" value={value.email} onChange={(e) => set('email', e.target.value)} />
            </label>
            <label className={s.field}>
              Work Phone
              <Input value={value.workPhone} onChange={(e) => set('workPhone', e.target.value)} />
            </label>
          </>
        )}

        <label className={s.field}>
          Title
          <Input value={value.title} onChange={(e) => set('title', e.target.value)} />
        </label>
        {!showEmail && (
          <label className={s.field}>
            Work Phone
            <Input value={value.workPhone} onChange={(e) => set('workPhone', e.target.value)} />
          </label>
        )}

        <label className={s.field}>
          Organization
          <Input value={value.organization} onChange={(e) => set('organization', e.target.value)} />
        </label>
        <label className={s.field}>
          Home Phone
          <Input value={value.homePhone} onChange={(e) => set('homePhone', e.target.value)} />
        </label>

        <div className={s.field}>
          Country
          <Select
            instanceId={`${instanceIdPrefix}-country`}
            options={COUNTRIES}
            value={value.country}
            onChange={(v) => set('country', v)}
            placeholder="-- Select --"
          />
        </div>
        <label className={s.field}>
          Fax
          <Input value={value.fax} onChange={(e) => set('fax', e.target.value)} />
        </label>

        <label className={s.field}>
          Address
          <Input value={value.street1} onChange={(e) => set('street1', e.target.value)} />
          <Input value={value.street2} onChange={(e) => set('street2', e.target.value)} className={s.secondLine} />
        </label>
        <div />

        <label className={s.field}>
          City
          <Input value={value.city} onChange={(e) => set('city', e.target.value)} />
        </label>
        <div />

        <label className={s.field}>
          State
          <Input value={value.state} onChange={(e) => set('state', e.target.value)} />
        </label>
        <div />

        <label className={s.field}>
          Postal Code
          <Input value={value.postalCode} onChange={(e) => set('postalCode', e.target.value)} />
        </label>
      </div>
    </div>
  );
}
