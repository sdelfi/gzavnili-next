'use client';

import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
import { payMethodOptions } from '@/lib/parcels/constants';
import s from './ParcelAddPaymentSection.module.css';

// The batch "Add Parcel" screen's bottom panel — legacy's `panel-heading` block below the
// parcels table in `views/parcels/vwParcelsAdd.cfm`: the "Add Parcel" button (opens the
// per-parcel draft modal), the two "Payment method"/amount pairs, the "Price Total" override,
// the notification checkboxes, and the batch's own "Save" button — all one bordered/backed
// panel in legacy, not two separate blocks. "Save" spans the panel's full height on the right,
// same as "Add Parcel"/"Payment method 1" etc. share the left side across however many lines
// they wrap onto.
//
// "Payment method 1" is the only one of these four payment fields with any real effect:
// anything but "Debt" marks every drafted parcel paid in full (see `parcelBatchAdd.ts`'s file
// header — the split legacy computes from the two Amount fields was traced all the way into
// the DAO and turns out to be dead code, invoicing each parcel's full debt regardless of what's
// typed here). Kept in the form anyway, matching the legacy screen operators actually see,
// pending a product decision on whether to remove them now that's confirmed
// (docs/decisions/0017). "Price Total" blank means "use the calculated total" the same way —
// not shown as an on-screen hint, since legacy's own screen doesn't say so either.

export type PaymentFormState = {
  paymentMethod1: string;
  paymentAmount1: string;
  paymentMethod2: string;
  paymentAmount2: string;
  priceTotal: string;
  notifications: ('Mail' | 'SMS')[];
};

export function blankPaymentForm(): PaymentFormState {
  return { paymentMethod1: '', paymentAmount1: '', paymentMethod2: '', paymentAmount2: '', priceTotal: '', notifications: [] };
}

export function ParcelAddPaymentSection({
  form,
  set,
  adminCountry,
  errors,
  onAdd,
  addDisabled,
  onSubmit,
  saving,
  submitDisabled,
}: {
  form: PaymentFormState;
  set: <K extends keyof PaymentFormState>(key: K, value: PaymentFormState[K]) => void;
  adminCountry: string | null;
  errors: Record<string, string>;
  onAdd: () => void;
  addDisabled: boolean;
  onSubmit: () => void;
  saving: boolean;
  submitDisabled: boolean;
}) {
  function toggleNotification(kind: 'Mail' | 'SMS', checked: boolean) {
    set('notifications', checked ? [...form.notifications, kind] : form.notifications.filter((n) => n !== kind));
  }

  return (
    <div className={s.panel}>
      <div className={s.fields}>
        <Button type="button" variant="success" onClick={onAdd} disabled={addDisabled}>
          Add Parcel
        </Button>

        <Field label="Payment method 1:" width="lg" inline>
          <Select
            instanceId="batch-paymethod1"
            size="sm"
            options={payMethodOptions(adminCountry).concat([{ value: 'Debt', label: 'Debt' }])}
            value={form.paymentMethod1}
            onChange={(v) => set('paymentMethod1', v)}
            error={errors.paymentMethod1}
          />
        </Field>
        <Field label="Amount:" htmlFor="batch-payamount1" inline>
          <Input
            id="batch-payamount1"
            value={form.paymentAmount1}
            inputMode="decimal"
            onChange={(e) => set('paymentAmount1', e.target.value)}
          />
        </Field>

        <Field label="Payment method 2:" width="lg" inline>
          <Select
            instanceId="batch-paymethod2"
            size="sm"
            options={payMethodOptions(adminCountry)}
            value={form.paymentMethod2}
            onChange={(v) => set('paymentMethod2', v)}
            error={errors.paymentMethod2}
          />
        </Field>
        <Field label="Amount:" htmlFor="batch-payamount2" inline>
          <Input
            id="batch-payamount2"
            value={form.paymentAmount2}
            inputMode="decimal"
            onChange={(e) => set('paymentAmount2', e.target.value)}
          />
        </Field>

        <Field label="Price Total:" htmlFor="batch-pricetotal" inline>
          <Input
            id="batch-pricetotal"
            value={form.priceTotal}
            inputMode="decimal"
            onChange={(e) => set('priceTotal', e.target.value)}
          />
        </Field>

        <Field label="Notification types:" width="lg" inline>
          <Checkbox
            label="Via mail"
            checked={form.notifications.includes('Mail')}
            onChange={(e) => toggleNotification('Mail', e.target.checked)}
          />
          <Checkbox
            label="Via SMS"
            checked={form.notifications.includes('SMS')}
            onChange={(e) => toggleNotification('SMS', e.target.checked)}
          />
        </Field>
      </div>

      <div className={s.actions}>
        <Button type="button" className={s.save} onClick={onSubmit} disabled={submitDisabled}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
