'use client';

import { Field } from '@/components/ui/admin/Field';
import { Input } from '@/components/ui/admin/Input';
import { Select } from '@/components/ui/admin/Select';
import { RadioGroup } from '@/components/ui/admin/RadioGroup';
import { Checkbox } from '@/components/ui/admin/Checkbox';
import { Textarea } from '@/components/ui/admin/Textarea';
import { PARCEL_CONTENTS } from '@/lib/parcels/constants';
import type { DraftParcelFormState } from '@/lib/parcels/batchForm';
import s from './ParcelDraftFields.module.css';

// The batch "Add Parcel" modal's "Parcel Information" block — Delivery/Service/contents/
// tracking#/weight/value/group/notes/received — ported from the `#addParcel` modal in
// `views/parcels/vwParcelsAdd.cfm`. Radio buttons for Delivery/Service (not a `<select>`)
// because that's what legacy renders there — the one place on the parcels screens that does.
//
// Length/Width/High/Dim.Weight and the Store/Location fields are legacy's own, in that
// view's markup (`<!--- --->`) — not carried over here either.

const DELIVERY_OPTIONS = [
  { value: 'Pickup', label: 'Pickup' },
  { value: 'Delivery', label: 'Delivery' },
  { value: 'Region', label: 'Region' },
];

const SERVICE_OPTIONS = [
  { value: 'Regular', label: 'Regular' },
  { value: 'Express', label: 'Express' },
  { value: 'Cargo', label: 'Cargo' },
];

/** The two-letter prefix legacy always shows ahead of the typed tracking digits — first
 *  letter of Delivery, then first letter of Service. */
export function trackingPrefix(delivery: string, service: string): string {
  return `${delivery.charAt(0)}${service.charAt(0)}`.toUpperCase();
}

function trackingCore(fullValue: string, prefix: string): string {
  const upper = fullValue.toUpperCase();
  return upper.startsWith(prefix) ? upper.slice(prefix.length) : upper;
}

/** `yymmddHHmm`, minutes rounded up to the next 5 — legacy's default tracking-number seed
 *  (`vwParcelsAdd.cfm`'s inline `Ceiling(currentMinute * 2 / 10) / 2 * 10`). */
export function defaultTrackingCore(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const minute = Math.ceil(now.getMinutes() / 5) * 5;
  return `${pad(now.getFullYear() % 100)}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(minute)}`;
}

export function ParcelDraftFields({
  draft,
  set,
  admins,
  errors,
}: {
  draft: DraftParcelFormState;
  set: <K extends keyof DraftParcelFormState>(key: K, value: DraftParcelFormState[K]) => void;
  admins: { id: string; name: string }[];
  errors: Record<string, string>;
}) {
  const prefix = trackingPrefix(draft.delivery, draft.service);
  const adminOptions = [{ value: '', label: '—' }, ...admins.map((a) => ({ value: a.id, label: a.name }))];

  return (
    <div className={s.grid}>
      <Field label="Delivery:" width="lg">
        <RadioGroup
          name="draft-delivery"
          options={DELIVERY_OPTIONS}
          value={draft.delivery}
          onChange={(v) => set('delivery', v as DraftParcelFormState['delivery'])}
        />
      </Field>
      <Field label="Service:" width="lg">
        <RadioGroup
          name="draft-service"
          options={SERVICE_OPTIONS}
          value={draft.service}
          onChange={(v) => set('service', v as DraftParcelFormState['service'])}
        />
      </Field>

      <Field label="Tracking #:" htmlFor="draft-trackingnum">
        <div className={s.trackingnum}>
          <span className={s.prefix}>{prefix}</span>
          <Input
            id="draft-trackingnum"
            autoComplete="off"
            value={trackingCore(draft.trackingNum, prefix)}
            onChange={(e) => set('trackingNum', `${prefix}${e.target.value}`)}
            error={errors.trackingNum}
          />
        </div>
      </Field>

      <Field label="Weight:" htmlFor="draft-weight" width="sm">
        <Input
          id="draft-weight"
          value={draft.weight}
          inputMode="decimal"
          onChange={(e) => set('weight', e.target.value)}
          error={errors.weight}
        />
      </Field>
      <Field label="Value:" htmlFor="draft-value" width="sm">
        <Input
          id="draft-value"
          value={draft.value}
          inputMode="decimal"
          onChange={(e) => set('value', e.target.value)}
          error={errors.value}
        />
      </Field>
      <Field label="Group:" htmlFor="draft-group" width="sm" hint="Same delivery + service required within a group.">
        <Input
          id="draft-group"
          value={draft.groupId}
          onChange={(e) => set('groupId', e.target.value)}
          error={errors.groupId}
        />
      </Field>

      <Field label="Parcel Content:" width="lg">
        <Select
          instanceId="draft-contents"
          size="sm"
          isSearchable
          isClearable
          placeholder="—"
          options={PARCEL_CONTENTS.map((item) => ({ value: item, label: item }))}
          value={PARCEL_CONTENTS.includes(draft.contents) ? draft.contents : ''}
          onChange={(value) => set('contents', value)}
        />
        <Input
          className={s.contentsOther}
          value={draft.contents}
          placeholder="or type it"
          onChange={(e) => set('contents', e.target.value)}
        />
      </Field>

      <Field label="Received:" htmlFor="draft-received">
        <Input
          id="draft-received"
          type="date"
          value={draft.trackingReceived}
          onChange={(e) => set('trackingReceived', e.target.value)}
        />
      </Field>
      <Field label="Received by:" width="lg">
        <Select
          instanceId="draft-receivedby"
          size="sm"
          isSearchable
          options={adminOptions}
          value={draft.trackingReceivedBy}
          onChange={(value) => set('trackingReceivedBy', value)}
        />
      </Field>

      <Field label=" " width="lg">
        <Checkbox label="Notify" checked={draft.notify} onChange={(e) => set('notify', e.target.checked)} />
      </Field>

      <Field label="Note:" htmlFor="draft-notes" width="lg">
        <Textarea id="draft-notes" rows={3} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
      </Field>
    </div>
  );
}
