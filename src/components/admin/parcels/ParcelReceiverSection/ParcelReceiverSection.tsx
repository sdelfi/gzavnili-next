'use client';

import { useEffect, useState } from 'react';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { listDeliveryOffices, listReceivers, type ReceiverOption } from '@/lib/api/bema/parcels';
import type { ParcelFormState } from '@/lib/parcels/form';
import s from './ParcelReceiverSection.module.css';

// "Receiver Info" — who the parcel is being delivered to, and which Georgian office it goes
// through. Ported from the fieldset of the same name in views/parcels/vwParcelsUpdate.cfm.
//
// The receiver dropdown is the sender's own saved receivers, reloaded whenever the customer
// changes (legacy: `bema/ajax/receivers.cfm` on customer change, then
// `bema/ajax/receiver.cfm` on every selection to fetch that one's address). Picking one fills
// the address fields below; "< New Receiver >" leaves them for typing, and the save creates
// the receiver. Editing the fields after picking edits that receiver — same as legacy.

const NEW_RECEIVER = '';

export function ParcelReceiverSection({
  form,
  setReceiver,
  set,
  errors,
}: {
  form: ParcelFormState;
  setReceiver: <K extends keyof ParcelFormState['receiver']>(key: K, value: ParcelFormState['receiver'][K]) => void;
  set: <K extends keyof ParcelFormState>(key: K, value: ParcelFormState[K]) => void;
  errors: Record<string, string>;
}) {
  // Stored together with the customer they were loaded for, and read back only when that
  // still matches — so switching customer shows an empty list immediately rather than the
  // previous customer's receivers until the next request lands.
  const [loaded, setLoaded] = useState<{ userId: string; receivers: ReceiverOption[] }>({
    userId: '',
    receivers: [],
  });
  const [offices, setOffices] = useState<{ id: string; label: string }[]>([]);

  const userId = form.userId;
  const receivers = loaded.userId === userId ? loaded.receivers : [];

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    listReceivers(userId)
      .then((data) => !cancelled && setLoaded({ userId, receivers: data.receivers }))
      .catch(() => !cancelled && setLoaded({ userId, receivers: [] }));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    listDeliveryOffices()
      .then((data) => !cancelled && setOffices(data.offices))
      .catch(() => !cancelled && setOffices([]));
    return () => {
      cancelled = true;
    };
  }, []);

  function chooseReceiver(receiverId: string) {
    setReceiver('receiverId', receiverId);
    if (receiverId === NEW_RECEIVER) return;

    const chosen = receivers.find((r) => r.id === receiverId);
    if (!chosen) return;
    for (const [key, value] of Object.entries(chosen.address)) {
      setReceiver(key as keyof ParcelFormState['receiver'], value as never);
    }
    setReceiver('isGeCitizen', chosen.isGeCitizen);
  }

  const receiverOptions = [
    { value: NEW_RECEIVER, label: '< New Receiver >' },
    ...receivers.map((r) => ({ value: r.id, label: r.label })),
    // A receiver that was deleted after this parcel was created still has to be selectable,
    // or saving the form would silently reassign the parcel to a new one.
    ...(form.receiver.receiverId && !receivers.some((r) => r.id === form.receiver.receiverId)
      ? [{ value: form.receiver.receiverId, label: '< Deleted Receiver >' }]
      : []),
  ];

  const isGe = form.receiver.isGeCitizen;

  return (
    <fieldset className={s.section}>
      <legend className={s.legend}>Receiver Info</legend>

      <div className={s.grid}>
        <Field label="Receiver:" width="lg">
          <Select
            instanceId="parcel-receiver"
            size="sm"
            isSearchable
            options={receiverOptions}
            value={form.receiver.receiverId}
            onChange={chooseReceiver}
          />
        </Field>

        <Field label=" " width="lg">
          <Checkbox
            label="Is Georgian Citizen?"
            checked={isGe}
            onChange={(e) => setReceiver('isGeCitizen', e.target.checked)}
          />
        </Field>

        {/* Which name pair is required follows the citizenship flag; both are always shown,
            since a receiver can legitimately have a name recorded in both scripts. */}
        <Field label={isGe ? 'First Name (Latin):' : 'First Name:'} htmlFor="receiver-firstname">
          <Input
            id="receiver-firstname"
            value={form.receiver.firstName}
            onChange={(e) => setReceiver('firstName', e.target.value)}
            error={errors['receiver.firstName']}
          />
        </Field>
        <Field label={isGe ? 'Last Name (Latin):' : 'Last Name:'} htmlFor="receiver-lastname">
          <Input
            id="receiver-lastname"
            value={form.receiver.lastName}
            onChange={(e) => setReceiver('lastName', e.target.value)}
            error={errors['receiver.lastName']}
          />
        </Field>

        <Field label="First Name (GE):" htmlFor="receiver-firstnamege">
          <Input
            id="receiver-firstnamege"
            value={form.receiver.firstNameGe}
            onChange={(e) => setReceiver('firstNameGe', e.target.value)}
            error={errors['receiver.firstNameGe']}
          />
        </Field>
        <Field label="Last Name (GE):" htmlFor="receiver-lastnamege">
          <Input
            id="receiver-lastnamege"
            value={form.receiver.lastNameGe}
            onChange={(e) => setReceiver('lastNameGe', e.target.value)}
            error={errors['receiver.lastNameGe']}
          />
        </Field>

        <Field label="Organization:" htmlFor="receiver-organization" width="lg">
          <Input
            id="receiver-organization"
            value={form.receiver.organization}
            onChange={(e) => setReceiver('organization', e.target.value)}
          />
        </Field>

        <Field label="Country:" htmlFor="receiver-country">
          <Input
            id="receiver-country"
            value={form.receiver.country}
            maxLength={2}
            placeholder="GE"
            onChange={(e) => setReceiver('country', e.target.value.toUpperCase())}
            error={errors['receiver.country']}
          />
        </Field>

        <Field label="Address:" htmlFor="receiver-street1" width="lg">
          <Input
            id="receiver-street1"
            value={form.receiver.street1}
            onChange={(e) => setReceiver('street1', e.target.value)}
          />
        </Field>
        <Field label="Address 2:" htmlFor="receiver-street2" width="lg">
          <Input
            id="receiver-street2"
            value={form.receiver.street2}
            onChange={(e) => setReceiver('street2', e.target.value)}
          />
        </Field>

        <Field label="City:" htmlFor="receiver-city">
          <Input
            id="receiver-city"
            value={form.receiver.city}
            onChange={(e) => setReceiver('city', e.target.value)}
            error={errors['receiver.city']}
          />
        </Field>
        <Field label="State:" htmlFor="receiver-state">
          <Input
            id="receiver-state"
            value={form.receiver.state}
            onChange={(e) => setReceiver('state', e.target.value)}
            error={errors['receiver.state']}
          />
        </Field>
        <Field label="Postal Code:" htmlFor="receiver-postalcode">
          <Input
            id="receiver-postalcode"
            value={form.receiver.postalCode}
            onChange={(e) => setReceiver('postalCode', e.target.value)}
            error={errors['receiver.postalCode']}
          />
        </Field>

        <Field label="Phone (1):" htmlFor="receiver-phone1">
          <Input
            id="receiver-phone1"
            value={form.receiver.phone1}
            onChange={(e) => setReceiver('phone1', e.target.value)}
            error={errors['receiver.phone1']}
          />
        </Field>
        <Field label="Phone (2):" htmlFor="receiver-phone2">
          <Input
            id="receiver-phone2"
            value={form.receiver.phone2}
            onChange={(e) => setReceiver('phone2', e.target.value)}
          />
        </Field>
        <Field label="Private #:" htmlFor="receiver-phone3">
          <Input
            id="receiver-phone3"
            value={form.receiver.phone3}
            onChange={(e) => setReceiver('phone3', e.target.value)}
          />
        </Field>

        <Field label="Delivery Office:" width="lg">
          <Select
            instanceId="parcel-office"
            size="sm"
            isSearchable
            isClearable
            placeholder="Select option"
            options={offices.map((office) => ({ value: office.id, label: office.label }))}
            value={form.officeId}
            onChange={(value) => set('officeId', value)}
          />
        </Field>
      </div>
    </fieldset>
  );
}
