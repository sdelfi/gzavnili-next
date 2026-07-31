'use client';

import { useEffect, useState } from 'react';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { CustomerPicker } from '@/components/admin/parcels/CustomerPicker';
import { PARCEL_CONTENTS, SERVICE_OPTIONS } from '@/lib/parcels/constants';
import { checkTrackingNum } from '@/lib/api/bema/parcels';
import type { ParcelFormState } from '@/lib/parcels/form';
import s from './ParcelDetailsSection.module.css';

// The parcel's own identity: what it is, whose it is, and which trip it goes on. Ported from
// the top block of views/parcels/vwParcelsUpdate.cfm (its untitled first `<table>`, above the
// "Receiver Info" fieldset).
//
// Legacy pops an `alert('Don\'t forget to check the AWB field')` whenever Service or Trip
// Date changes on an existing parcel. Same intent here as an inline warning next to the AWB
// field instead — a modal that interrupts typing to say "remember something later" is the
// worst possible shape for that reminder.

const TRACKING_CHECK_DEBOUNCE_MS = 400;

export function ParcelDetailsSection({
  form,
  set,
  errors,
  parcelId,
}: {
  form: ParcelFormState;
  set: <K extends keyof ParcelFormState>(key: K, value: ParcelFormState[K]) => void;
  errors: Record<string, string>;
  parcelId: string;
}) {
  // The answer is stored with the number it was asked about, so it stops applying the moment
  // the field changes — no stale "already exists" warning against a number the operator has
  // since corrected.
  const [checked, setChecked] = useState<{ trackingNum: string; exists: boolean }>({
    trackingNum: '',
    exists: false,
  });
  const [awbReminder, setAwbReminder] = useState(false);

  const trackingNum = form.trackingNum.trim();
  const duplicate = checked.trackingNum === trackingNum && checked.exists;

  // Live duplicate check as the operator types, exactly like legacy's `checkTrackingNum()`
  // poll — advisory, since the save re-checks it where it can't be raced.
  useEffect(() => {
    if (!trackingNum) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      checkTrackingNum(trackingNum, parcelId)
        .then(({ exists }) => !cancelled && setChecked({ trackingNum, exists }))
        .catch(() => {
          // The warning is advisory; a failed check just means no warning.
        });
    }, TRACKING_CHECK_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trackingNum, parcelId]);

  return (
    <fieldset className={s.section}>
      <legend className={s.legend}>Parcel</legend>

      <div className={s.grid}>
        <Field label="Tracking #:" htmlFor="parcel-trackingnum" width="lg">
          <Input
            id="parcel-trackingnum"
            value={form.trackingNum}
            autoComplete="off"
            onChange={(e) => set('trackingNum', e.target.value)}
            error={errors.trackingNum}
          />
          {duplicate && !errors.trackingNum && (
            <span className={s.warning}>Tracking # already exists on another parcel.</span>
          )}
        </Field>

        <Field label="Tracking # 2:" htmlFor="parcel-trackingnum2" width="lg">
          <Input
            id="parcel-trackingnum2"
            value={form.trackingNum2}
            onChange={(e) => set('trackingNum2', e.target.value)}
          />
        </Field>

        <Field label="Customer:" width="lg">
          <CustomerPicker
            value={form.userId}
            label={form.userLabel}
            error={errors.userId}
            onChange={(customer) => {
              set('userId', customer.id);
              set('userLabel', customer.label);
            }}
          />
        </Field>

        <Field label="Trip Date:" htmlFor="parcel-tripdate">
          <Input
            id="parcel-tripdate"
            type="date"
            value={form.tripDate}
            onChange={(e) => {
              set('tripDate', e.target.value);
              setAwbReminder(true);
            }}
            error={errors.tripDate}
          />
        </Field>

        <Field label="Service:">
          <Select
            instanceId="parcel-service-edit"
            size="sm"
            options={SERVICE_OPTIONS}
            value={form.service}
            onChange={(value) => {
              set('service', value);
              setAwbReminder(true);
            }}
            error={errors.service}
          />
        </Field>

        <Field label="AWB:" htmlFor="parcel-awb">
          <Input id="parcel-awb" value={form.awb} onChange={(e) => set('awb', e.target.value)} />
          {awbReminder && <span className={s.warning}>Service or trip date changed — check the AWB.</span>}
        </Field>

        <Field label="Parcel Content:">
          <Select
            instanceId="parcel-contents"
            size="sm"
            isSearchable
            isClearable
            placeholder="—"
            options={PARCEL_CONTENTS.map((item) => ({ value: item, label: item }))}
            value={PARCEL_CONTENTS.includes(form.contents) ? form.contents : ''}
            onChange={(value) => set('contents', value)}
          />
          {/* Legacy pairs the dropdown with a free-text box and stores whichever is filled,
              using the literal value "Other" as the switch. The dropdown here is just a
              shortcut into the same single text field — no sentinel value to round-trip. */}
          <Input
            className={s.contentsOther}
            value={form.contents}
            placeholder="or type it"
            onChange={(e) => set('contents', e.target.value)}
          />
        </Field>

        <Field label="Store:" htmlFor="parcel-store">
          <Input id="parcel-store" value={form.store} onChange={(e) => set('store', e.target.value)} />
        </Field>
      </div>
    </fieldset>
  );
}
