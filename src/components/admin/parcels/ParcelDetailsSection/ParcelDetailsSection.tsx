'use client';

import { useEffect, useRef, useState } from 'react';
import { Field } from '@/components/ui/admin/Field';
import { Input } from '@/components/ui/admin/Input';
import { Select } from '@/components/ui/admin/Select';
import { CustomerPicker } from '@/components/ui/admin/CustomerPicker';
import { PARCEL_CONTENTS, SERVICE_OPTIONS } from '@/lib/parcels/constants';
import { checkTrackingNum } from '@/lib/api/bema/parcels';
import type { ParcelFormState } from '@/lib/parcels/form';
import s from './ParcelDetailsSection.module.css';

// The parcel's own identity: what it is, whose it is, and which trip it goes on. Ported from
// the top block of views/parcels/vwParcelsUpdate.cfm (its untitled first `<table>`, above the
// "Receiver Info" fieldset) — shared by both the edit screen and the add screen, exactly as
// legacy serves both from the same view keyed on `nrc`.
//
// Legacy pops an `alert('Don\'t forget to check the AWB field')` whenever Service or Trip
// Date changes on an existing parcel. Same intent here as an inline warning next to the AWB
// field instead — a modal that interrupts typing to say "remember something later" is the
// worst possible shape for that reminder.
//
// Two behaviors ported here that the edit screen's first pass missed (found while building
// the add screen, which shares this component — see docs/decisions/0017-bema-add-parcel.md):
// the AWB field is legacy's `<cfif form.nrc neq 1>` — shown only when editing, a hidden
// forced-empty input on add (a brand-new parcel doesn't have a carrier AWB yet); and
// `goWeight()`'s store auto-toggle, which defaults Store to "Personal" for Regular service
// and clears an auto-set "Personal" away from it for anything else.

const TRACKING_CHECK_DEBOUNCE_MS = 400;

export function ParcelDetailsSection({
  form,
  set,
  errors,
  parcelId,
  mode = 'edit',
}: {
  form: ParcelFormState;
  set: <K extends keyof ParcelFormState>(key: K, value: ParcelFormState[K]) => void;
  errors: Record<string, string>;
  /** Excluded from the duplicate-tracking-number check; absent on the add screen, where
   *  there is no parcel yet to exclude. */
  parcelId?: string;
  mode?: 'create' | 'edit';
}) {
  const [checked, setChecked] = useState<{ trackingNum: string; exists: boolean }>({
    trackingNum: '',
    exists: false,
  });
  const [awbReminder, setAwbReminder] = useState(false);
  const trackingInputRef = useRef<HTMLInputElement>(null);

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

  // Legacy focuses and selects the Tracking # field on page load in both modes
  // (`$('trackingnum').focus(); $('trackingnum').select();`) — the field an operator is about
  // to type into first, whether adding a parcel or fixing one up.
  useEffect(() => {
    trackingInputRef.current?.select();
  }, []);

  function handleServiceChange(service: string) {
    set('service', service);
    setAwbReminder(true);
    // `goWeight()`'s store default: Regular parcels default to "Personal" if Store is blank;
    // leaving Regular clears an auto-set "Personal" back out again. An operator's own text in
    // Store is never touched either direction.
    if (service === 'Regular' && form.store === '') set('store', 'Personal');
    else if (service !== 'Regular' && form.store === 'Personal') set('store', '');
  }

  return (
    <fieldset className={s.section}>
      <legend className={s.legend}>Parcel</legend>

      <div className={s.grid}>
        <Field label="Tracking #:" htmlFor="parcel-trackingnum" width="lg">
          <Input
            ref={trackingInputRef}
            id="parcel-trackingnum"
            value={form.trackingNum}
            autoComplete="off"
            autoFocus
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
            onChange={handleServiceChange}
            error={errors.service}
          />
        </Field>

        {/* Hidden on the add screen — legacy's `<cfif form.nrc neq 1>`: a brand-new parcel
            has no carrier AWB yet, so the field (and the reminder it drives) don't apply. */}
        {mode === 'edit' && (
          <Field label="AWB:" htmlFor="parcel-awb">
            <Input id="parcel-awb" value={form.awb} onChange={(e) => set('awb', e.target.value)} />
            {awbReminder && <span className={s.warning}>Service or trip date changed — check the AWB.</span>}
          </Field>
        )}

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
