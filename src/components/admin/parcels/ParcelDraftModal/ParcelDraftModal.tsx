'use client';

import { useState } from 'react';
import { Dialog } from '@/components/ui/admin/Dialog';
import { Button } from '@/components/ui/admin/Button';
import { Checkbox } from '@/components/ui/admin/Checkbox';
import { Field } from '@/components/ui/admin/Field';
import { Input } from '@/components/ui/admin/Input';
import { Select } from '@/components/ui/admin/Select';
import { ParcelDraftFields } from '@/components/admin/parcels/ParcelDraftFields';
import { ParcelReceiverSection } from '@/components/admin/parcels/ParcelReceiverSection';
import type { DraftParcelFormState } from '@/lib/parcels/batchForm';
import s from './ParcelDraftModal.module.css';

// The batch "Add Parcel" screen's per-parcel editor — legacy's `#addParcel` Bootstrap modal.
// Edits a local copy of the draft; nothing reaches the table until "Save parcel". Mount this
// with `key={draft.clientId}` from the caller so opening a different draft (or a fresh blank
// one) always starts from a clean copy instead of carrying over unsaved edits.

const REQUIRED_FIELDS: { key: keyof DraftParcelFormState; label: string }[] = [
  { key: 'trackingNum', label: 'Tracking #' },
  { key: 'weight', label: 'Weight' },
  { key: 'value', label: 'Value' },
];

export function ParcelDraftModal({
  open,
  onClose,
  draft,
  onSave,
  isEdit,
  userId,
  admins,
}: {
  open: boolean;
  onClose: () => void;
  draft: DraftParcelFormState;
  onSave: (draft: DraftParcelFormState) => void;
  isEdit: boolean;
  userId: string;
  admins: { id: string; name: string }[];
}) {
  const [working, setWorking] = useState(draft);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof DraftParcelFormState>(key: K, value: DraftParcelFormState[K]) {
    setWorking((prev) => ({ ...prev, [key]: value }));
  }
  function setReceiver<K extends keyof DraftParcelFormState['receiver']>(
    key: K,
    value: DraftParcelFormState['receiver'][K],
  ) {
    setWorking((prev) => ({ ...prev, receiver: { ...prev.receiver, [key]: value } }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    for (const { key, label } of REQUIRED_FIELDS) {
      if (!String(working[key]).trim()) next[key] = `${label} is required.`;
    }
    if (!working.receiver.isGeCitizen && working.receiver.firstName === '') next['receiver.firstName'] = 'Required.';
    if (!working.receiver.isGeCitizen && working.receiver.lastName === '') next['receiver.lastName'] = 'Required.';
    if (working.receiver.city === '') next['receiver.city'] = 'Required.';
    if (working.receiver.phone1 === '') next['receiver.phone1'] = 'Required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSave(forceNewReceiver: boolean) {
    if (!validate()) return;
    onSave(forceNewReceiver ? { ...working, receiver: { ...working.receiver, receiverId: '' } } : working);
  }

  const receiverErrors = Object.fromEntries(
    Object.entries(errors)
      .filter(([key]) => key.startsWith('receiver.'))
      .map(([key, value]) => [key.replace('receiver.', ''), value]),
  );
  const adminOptions = [{ value: '', label: '—' }, ...admins.map((a) => ({ value: a.id, label: a.name }))];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit parcel' : 'Add parcel'}
      size="xl"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button type="button" onClick={() => handleSave(false)}>
            {isEdit ? 'Save parcel' : 'Add parcel'}
          </Button>
          <Button type="button" variant="success" onClick={() => handleSave(true)}>
            {isEdit ? 'Save parcel and receiver' : 'Add parcel and receiver'}
          </Button>
        </>
      }
    >
      <div className={s.sections}>
        <ParcelDraftFields draft={working} set={set} errors={errors} />
        <ParcelReceiverSection
          form={{ userId, officeId: working.officeId, receiver: working.receiver }}
          setReceiver={setReceiver}
          set={(key, value) => set(key, value)}
          errors={receiverErrors}
          layout="batch"
          portalSelects
          afterFields={
            <>
              <Field label="Received:" htmlFor="draft-received">
                <Input
                  id="draft-received"
                  type="date"
                  value={working.trackingReceived}
                  onChange={(e) => set('trackingReceived', e.target.value)}
                />
              </Field>
              <Field label="Received by:" width="lg">
                <Select
                  instanceId="draft-receivedby"
                  size="sm"
                  isSearchable
                  portal
                  options={adminOptions}
                  value={working.trackingReceivedBy}
                  onChange={(value) => set('trackingReceivedBy', value)}
                />
              </Field>
            </>
          }
        />
        <div className={s.notifyRow}>
          <Checkbox label="Notify" checked={working.notify} onChange={(e) => set('notify', e.target.checked)} />
        </div>
      </div>
    </Dialog>
  );
}
