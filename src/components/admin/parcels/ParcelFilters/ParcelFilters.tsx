'use client';

import { useState, type FormEvent } from 'react';
import { Field } from '@/components/ui/admin/Field';
import { Input } from '@/components/ui/admin/Input';
import { Select } from '@/components/ui/admin/Select';
import { Button } from '@/components/ui/admin/Button';
import {
  CITY_FILTER_OPTIONS,
  PAID_FILTER_OPTIONS,
  PER_PAGE_OPTIONS,
  SERVICE_FILTER_GROUPS,
  STATUS_FILTER_OPTIONS,
} from '@/lib/parcels/constants';
import type { ParcelFiltersState } from '@/lib/api/bema/parcels';
import s from './ParcelFilters.module.css';

// The primary search form of the bema parcels list — a 1:1 port of the first `<fieldset
// class="search">` in views/parcels/vwParcels_work2.cfm, same fields in the same order.
//
// It is a *draft* form, like the legacy one: typing changes nothing until GO is pressed
// (legacy submitted a GET form). That matters here beyond fidelity — these are expensive
// queries over the whole parcels table, and a filter bar that refetched on every keystroke
// would be unusable.

export function ParcelFilters({
  filters,
  onApply,
  exportHref,
  airwayExportHref,
  canExport,
}: {
  filters: ParcelFiltersState;
  onApply: (patch: Partial<ParcelFiltersState>) => void;
  exportHref: string;
  airwayExportHref: string;
  canExport: boolean;
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

  return (
    <form className={s.form} onSubmit={handleSubmit}>
      <div className={s.row}>
        <div className={s.fields}>
          <Field label="Show:" width="sm">
            <Select
              instanceId="parcel-perpage"
              size="sm"
              options={PER_PAGE_OPTIONS}
              value={String(draft.perPage)}
              onChange={(value) => set('perPage', Number(value) || 25)}
            />
          </Field>

          <Field label="Search:" htmlFor="parcel-search">
            <Input
              id="parcel-search"
              value={draft.search}
              placeholder="Receiver, tracking #, AWB…"
              onChange={(e) => set('search', e.target.value)}
            />
          </Field>

          <Field label="Sender:" htmlFor="parcel-sender">
            <Input
              id="parcel-sender"
              value={draft.sender}
              placeholder="Name or username"
              onChange={(e) => set('sender', e.target.value)}
            />
          </Field>

          <Field label="Trip Date:" htmlFor="parcel-tripdate">
            <Input
              id="parcel-tripdate"
              type="date"
              value={draft.tripDate}
              onChange={(e) => set('tripDate', e.target.value)}
            />
          </Field>

          <Field label="Received Date:" htmlFor="parcel-receiveddate">
            <Input
              id="parcel-receiveddate"
              type="date"
              value={draft.receivedDate}
              onChange={(e) => set('receivedDate', e.target.value)}
            />
          </Field>

          <Field label="Service/Type:">
            <Select
              instanceId="parcel-service"
              size="sm"
              isClearable
              placeholder="Any"
              options={SERVICE_FILTER_GROUPS}
              value={draft.service}
              onChange={(value) => set('service', value)}
            />
          </Field>

          <Field label="Group:" htmlFor="parcel-groupid" width="sm">
            <Input
              id="parcel-groupid"
              value={draft.groupId}
              maxLength={5}
              onChange={(e) => set('groupId', e.target.value)}
            />
          </Field>

          <Field label="City:">
            <Select
              instanceId="parcel-city"
              size="sm"
              options={CITY_FILTER_OPTIONS}
              value={draft.city}
              onChange={(value) => set('city', value)}
            />
          </Field>

          <Field label="Status:">
            <Select
              instanceId="parcel-status"
              size="sm"
              options={STATUS_FILTER_OPTIONS}
              value={draft.status}
              onChange={(value) => set('status', value)}
            />
          </Field>

          <Field label="Status Date:" htmlFor="parcel-statusdate">
            <Input
              id="parcel-statusdate"
              type="date"
              value={draft.statusDate}
              onChange={(e) => set('statusDate', e.target.value)}
            />
          </Field>

          <Field label="Paid:" width="sm">
            <Select
              instanceId="parcel-ispaid"
              size="sm"
              options={PAID_FILTER_OPTIONS}
              value={draft.isPaid}
              onChange={(value) => set('isPaid', value)}
            />
          </Field>

          <Field label="Debt:" htmlFor="parcel-debt" width="sm">
            <Input id="parcel-debt" value={draft.debt} onChange={(e) => set('debt', e.target.value)} />
          </Field>
        </div>

        <div className={s.actions}>
          <Button type="submit">GO</Button>
          {canExport && (
            <a className={s.exportLink} href={exportHref} download>
              Export Parcels (CSV)
            </a>
          )}
          {canExport && (
            <a className={s.exportLink} href={airwayExportHref} download>
              Export Airway
            </a>
          )}
        </div>
      </div>
    </form>
  );
}
