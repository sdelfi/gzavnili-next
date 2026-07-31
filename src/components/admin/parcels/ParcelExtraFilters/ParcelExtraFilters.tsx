'use client';

import { useState, type FormEvent } from 'react';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { EXTRA_STATUS_FILTER_OPTIONS, HOUR_OPTIONS, MINUTE_OPTIONS } from '@/lib/parcels/constants';
import type { ParcelFiltersState } from '@/lib/api/bema/parcels';
import s from './ParcelExtraFilters.module.css';

// The second search form ("Extra Search" in views/parcels/vwParcels_work2.cfm): find parcels
// that hit a given milestone inside a From/To window, optionally narrowed to the admin who
// received them. Answers "what did we deliver between 09:00 and 13:00 yesterday, and who
// signed it in" — a different question from the main form's "where is this parcel now", which
// is why it exists as its own form rather than more fields on the first one.
//
// Legacy hides this whole form from agents (`session.buser.getGroupId() neq 15`), since an
// agent's list is already pinned to their own parcels. Same here, via the caller.
//
// Two legacy details deliberately not reproduced: the form repeats the "Show:" per-page
// dropdown (a duplicate of the main form's, and whichever form you submitted last won), and
// its "To" hour dropdown marks the selected option against `url.eh1` instead of `url.eh2`,
// so the To-hour never showed what was actually applied. Both are plain bugs.

export function ParcelExtraFilters({
  filters,
  onApply,
  admins,
}: {
  filters: ParcelFiltersState;
  onApply: (patch: Partial<ParcelFiltersState>) => void;
  admins: { id: string; name: string }[];
}) {
  // Seeded from the applied filters and then owned by this form. When the applied filters
  // change from outside it (browser Back, "Clear filters"), the parent remounts this
  // component with a new `key` rather than syncing the draft back in an effect.
  const [draft, setDraft] = useState(filters);

  const set = <K extends keyof ParcelFiltersState>(key: K, value: ParcelFiltersState[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onApply({ ...draft, page: 1 });
  }

  const adminOptions = [{ value: '', label: 'Any' }, ...admins.map((a) => ({ value: a.id, label: a.name }))];

  return (
    <form className={s.form} onSubmit={handleSubmit}>
      <span className={s.title}>Extra search</span>

      <div className={s.row}>
        <Field label="From Date:" htmlFor="parcel-fromdate">
          <Input
            id="parcel-fromdate"
            type="date"
            value={draft.fromDate}
            onChange={(e) => set('fromDate', e.target.value)}
          />
        </Field>
        <Field label="HH:" width="sm">
          <Select
            instanceId="parcel-fromhour"
            size="sm"
            options={HOUR_OPTIONS}
            value={draft.fromHour}
            onChange={(value) => set('fromHour', value)}
          />
        </Field>
        <Field label="MM:" width="sm">
          <Select
            instanceId="parcel-fromminute"
            size="sm"
            options={MINUTE_OPTIONS}
            value={draft.fromMinute}
            onChange={(value) => set('fromMinute', value)}
          />
        </Field>

        <Field label="To Date:" htmlFor="parcel-todate">
          <Input id="parcel-todate" type="date" value={draft.toDate} onChange={(e) => set('toDate', e.target.value)} />
        </Field>
        <Field label="HH:" width="sm">
          <Select
            instanceId="parcel-tohour"
            size="sm"
            options={HOUR_OPTIONS}
            value={draft.toHour}
            onChange={(value) => set('toHour', value)}
          />
        </Field>
        <Field label="MM:" width="sm">
          <Select
            instanceId="parcel-tominute"
            size="sm"
            options={MINUTE_OPTIONS}
            value={draft.toMinute}
            onChange={(value) => set('toMinute', value)}
          />
        </Field>

        <Field label="Status:">
          <Select
            instanceId="parcel-estatus"
            size="sm"
            options={EXTRA_STATUS_FILTER_OPTIONS}
            value={draft.extraStatus}
            onChange={(value) => set('extraStatus', value)}
          />
        </Field>

        <Field label="Received By" width="lg">
          <Select
            instanceId="parcel-receivedby"
            size="sm"
            isSearchable
            options={adminOptions}
            value={draft.receivedBy}
            onChange={(value) => set('receivedBy', value)}
          />
        </Field>

        <div className={s.actions}>
          <Button type="submit">GO</Button>
        </div>
      </div>
    </form>
  );
}
