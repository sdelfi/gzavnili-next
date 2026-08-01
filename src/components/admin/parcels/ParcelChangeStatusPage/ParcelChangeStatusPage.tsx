'use client';

import { useEffect, useState } from 'react';
import { PageHeading } from '@/components/ui/admin/PageHeading';
import { Field } from '@/components/ui/admin/Field';
import { Input } from '@/components/ui/admin/Input';
import { Select } from '@/components/ui/admin/Select';
import { Button } from '@/components/ui/admin/Button';
import { Alert, ErrorList } from '@/components/ui/admin/Alert';
import { listUsers } from '@/lib/api/bema/users';
import { changeParcelStatus, listDeliveryOffices, lookupOnlineParcel } from '@/lib/api/bema/parcels';
import { ApiError, extractErrorMessages } from '@/lib/api/http';
import { CLEAR_OFFICE, type ChangeParcelStatusPayload } from '@/lib/validation/parcelChangeStatusSchema';
import s from './ParcelChangeStatusPage.module.css';

// bema "Change Parcel status" (`bema/parcels/parcels-change-status.cfm`) — a tracking-
// number-scan-driven bulk updater: pick an office/bema-user/status/location once, then scan
// several tracking numbers in a row, each one getting the same settings applied. See
// docs/decisions/0023-parcels-change-status.md.

const STATUS_OPTIONS: { value: ChangeParcelStatusPayload['operation']; label: string }[] = [
  { value: '', label: '' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'office', label: 'Received in Tbilisi office' },
  { value: 'processingCustom', label: 'Processing Custom' },
  { value: 'custom', label: 'Process Custom Clearance' },
  { value: 'outdelivery', label: 'Out of Delivery' },
  { value: 'delay', label: 'Delay' },
  { value: 'received', label: 'Received in USA' },
  { value: 'awaiting', label: 'Awaiting' },
  { value: 'region', label: 'Send to Region' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'paid', label: 'Paid' },
];

// Legacy remembers these four selections in `session.officeid`/`session.sbuser`/
// `session.operation`/`session.ilocation` across the whole bema session, so a rapid-fire
// scan-many-tracking-numbers workflow doesn't need re-picking them every time. This app's
// bema sessions carry no such arbitrary per-screen state, so `localStorage` stands in —
// same idiom already used for "Add Online Parcel"'s "Do not check tracking number" toggle.
const STORAGE_KEYS = {
  officeId: 'bema.parcelChangeStatus.officeId',
  buser: 'bema.parcelChangeStatus.buser',
  operation: 'bema.parcelChangeStatus.operation',
  iLocation: 'bema.parcelChangeStatus.iLocation',
};

type BemaUserOption = { id: string; username: string; firstName: string | null; lastName: string | null };

export function ParcelChangeStatusPage() {
  const [officeId, setOfficeIdState] = useState('');
  const [buser, setBuserState] = useState('');
  const [operation, setOperationState] = useState<ChangeParcelStatusPayload['operation']>('');
  const [iLocation, setILocationState] = useState('');
  const [trackingNum, setTrackingNum] = useState('');

  const [offices, setOffices] = useState<{ id: string; label: string }[]>([]);
  const [bemaUsers, setBemaUsers] = useState<BemaUserOption[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listDeliveryOffices()
      .then((data) => setOffices(data.offices))
      .catch(() => setOffices([]));
    listUsers<BemaUserOption>({
      accountType: 'BemaUser',
      active: 'true',
      page: 1,
      perPage: 200,
      sort: 'username',
      dir: 'asc',
    })
      .then((data) => setBemaUsers(data.items))
      .catch(() => setBemaUsers([]));
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      setOfficeIdState(localStorage.getItem(STORAGE_KEYS.officeId) ?? '');
      setBuserState(localStorage.getItem(STORAGE_KEYS.buser) ?? '');
      setOperationState((localStorage.getItem(STORAGE_KEYS.operation) as ChangeParcelStatusPayload['operation']) ?? '');
      setILocationState(localStorage.getItem(STORAGE_KEYS.iLocation) ?? '');
    });
  }, []);

  function setOfficeId(value: string) {
    setOfficeIdState(value);
    localStorage.setItem(STORAGE_KEYS.officeId, value);
  }
  function setBuser(value: string) {
    setBuserState(value);
    localStorage.setItem(STORAGE_KEYS.buser, value);
  }
  function setOperation(value: ChangeParcelStatusPayload['operation']) {
    setOperationState(value);
    localStorage.setItem(STORAGE_KEYS.operation, value);
  }
  function setILocation(value: string) {
    setILocationState(value);
    localStorage.setItem(STORAGE_KEYS.iLocation, value);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    setSaved(null);
    if (!trackingNum.trim()) return;

    setSubmitting(true);
    try {
      // Legacy `cutlength=12`, no `withtrackingnum2` — see docs/decisions/0023.
      const { parcel } = await lookupOnlineParcel(trackingNum, { cutLength: 12, withTrackingNum2: false });
      if (!parcel) {
        setErrors(['Track number not found']);
        return;
      }
      await changeParcelStatus(parcel.parcelId, { operation, officeId, buser, iLocation });
      setSaved('Parcel bema user, status and location has been successfully updated.');
      setTrackingNum('');
    } catch (err) {
      setErrors(err instanceof ApiError ? extractErrorMessages(err.body) : ['Save failed.']);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeading>Change Parcel status</PageHeading>
      <ErrorList errors={errors} />
      {saved && <Alert variant="success">{saved}</Alert>}

      <form className={s.row} onSubmit={handleSubmit}>
        <Field label="Delivery Office:" htmlFor="officeid">
          <Select
            instanceId="change-status-office"
            options={[
              { value: '', label: 'Select option' },
              ...offices.map((o) => ({ value: o.id, label: o.label })),
              { value: CLEAR_OFFICE, label: 'Set empty' },
            ]}
            value={officeId}
            onChange={setOfficeId}
          />
        </Field>
        <Field label="Bema User:" htmlFor="buser">
          <Select
            instanceId="change-status-buser"
            options={bemaUsers.map((u) => ({
              value: u.id,
              label: `${u.firstName ?? ''} ${u.lastName ?? ''} (${u.username})`,
            }))}
            value={buser}
            onChange={setBuser}
          />
        </Field>
        <Field label="Status:" htmlFor="operation">
          <Select
            instanceId="change-status-operation"
            options={STATUS_OPTIONS}
            value={operation}
            onChange={(v) => setOperation(v as ChangeParcelStatusPayload['operation'])}
          />
        </Field>
        <Field label="Location:" htmlFor="ilocation">
          <Input id="ilocation" value={iLocation} onChange={(e) => setILocation(e.target.value)} />
        </Field>
        <Field label="Tracking Number:" htmlFor="trackingnum">
          <Input id="trackingnum" autoFocus value={trackingNum} onChange={(e) => setTrackingNum(e.target.value)} />
        </Field>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </div>
  );
}
