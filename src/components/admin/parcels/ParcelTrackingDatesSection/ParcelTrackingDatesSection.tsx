'use client';

import { Field } from '@/components/ui/admin/Field';
import { Input } from '@/components/ui/admin/Input';
import { Select } from '@/components/ui/admin/Select';
import type { ParcelFormState } from '@/lib/parcels/form';
import s from './ParcelTrackingDatesSection.module.css';

// "Tracking Dates" — the parcel's milestone timestamps, set by hand. Ported from the
// fieldset of the same name in views/parcels/vwParcelsUpdate.cfm.
//
// These are the same columns the bulk toolbar stamps from the list screen and the same ones
// the list's Tracking column renders; this form is where an operator corrects one after the
// fact. `parcels.status` is *derived* from them by trigger, so there is no status field to
// edit — changing a date here changes the status, which is why the header shows the current
// one.
//
// `withTime` marks the five milestones legacy gives a time picker rather than a date picker.
// Same set as `DATETIME_OPERATIONS` in the bulk toolbar — the milestones operators time to
// the minute, because a delivery dispute turns on the hour it went out.
const DATE_FIELDS: { key: keyof ParcelFormState; label: string; withTime?: boolean }[] = [
  { key: 'trackingReceived', label: 'Received:' },
  { key: 'trackingAway', label: 'Awaiting:' },
  { key: 'trackingEstDelivery', label: 'Est Delivery:' },
  { key: 'trackingEstShip', label: 'Est Shipping:' },
  { key: 'trackingShipped', label: 'Shipped:' },
  { key: 'trackingDelay', label: 'Delay:' },
  { key: 'trackingCustom', label: 'On Custom:' },
  { key: 'trackingProcessingCustom', label: 'Processing Custom:', withTime: true },
  { key: 'trackingOffice', label: 'In Office:', withTime: true },
  { key: 'trackingSendRegion', label: 'Send to Region:', withTime: true },
  { key: 'trackingOutDelivery', label: 'Out of Delivery:', withTime: true },
  { key: 'trackingDeliveredSigned', label: 'Delivered/Signed:', withTime: true },
];

export function ParcelTrackingDatesSection({
  form,
  set,
  admins,
}: {
  form: ParcelFormState;
  set: <K extends keyof ParcelFormState>(key: K, value: ParcelFormState[K]) => void;
  admins: { id: string; name: string }[];
}) {
  const adminOptions = [{ value: '', label: '—' }, ...admins.map((a) => ({ value: a.id, label: a.name }))];

  return (
    <fieldset className={s.section}>
      <legend className={s.legend}>Tracking Dates</legend>

      <div className={s.grid}>
        {DATE_FIELDS.map(({ key, label, withTime }) => (
          <Field key={key} label={label} htmlFor={`parcel-${key}`}>
            <Input
              id={`parcel-${key}`}
              type={withTime ? 'datetime-local' : 'date'}
              value={form[key] as string}
              onChange={(e) => set(key, e.target.value as ParcelFormState[typeof key])}
            />
          </Field>
        ))}
      </div>

      <div className={s.grid}>
        <Field label="Received by:" width="lg">
          <Select
            instanceId="parcel-receivedby-edit"
            size="sm"
            isSearchable
            options={adminOptions}
            value={form.trackingReceivedBy}
            onChange={(value) => set('trackingReceivedBy', value)}
          />
        </Field>
        <Field label="Delivered/signed by:" width="lg">
          <Select
            instanceId="parcel-deliveredby"
            size="sm"
            isSearchable
            options={adminOptions}
            value={form.trackingDeliveredSignedBy}
            onChange={(value) => set('trackingDeliveredSignedBy', value)}
          />
        </Field>
      </div>
    </fieldset>
  );
}
