'use client';

import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { payMethodOptions } from '@/lib/parcels/constants';
import s from './ParcelAddPaymentSection.module.css';

// The batch "Add Parcel" screen's payment box — legacy's two "Payment method"/amount pairs
// plus the "Price Total" override and notification checkboxes, from the `panel-heading` block
// below the parcels table in `views/parcels/vwParcelsAdd.cfm`.
//
// "Payment method 1" is the only one of these four fields with any real effect: anything but
// "Debt" marks every drafted parcel paid in full (see `parcelBatchAdd.ts`'s file header — the
// split legacy computes from the two Amount fields was traced all the way into the DAO and
// turns out to be dead code, invoicing each parcel's full debt regardless of what's typed
// here). Kept in the form anyway, matching the legacy screen operators actually see, pending
// a product decision on whether to remove them now that's confirmed (docs/decisions/0017).

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
}: {
  form: PaymentFormState;
  set: <K extends keyof PaymentFormState>(key: K, value: PaymentFormState[K]) => void;
  adminCountry: string | null;
  errors: Record<string, string>;
}) {
  function toggleNotification(kind: 'Mail' | 'SMS', checked: boolean) {
    set('notifications', checked ? [...form.notifications, kind] : form.notifications.filter((n) => n !== kind));
  }

  return (
    <fieldset className={s.section}>
      <legend className={s.legend}>Payment</legend>

      <div className={s.grid}>
        <Field label="Payment method 1:" width="lg">
          <Select
            instanceId="batch-paymethod1"
            size="sm"
            options={payMethodOptions(adminCountry).concat([{ value: 'Debt', label: 'Debt' }])}
            value={form.paymentMethod1}
            onChange={(v) => set('paymentMethod1', v)}
            error={errors.paymentMethod1}
          />
        </Field>
        <Field label="Amount:" htmlFor="batch-payamount1">
          <Input
            id="batch-payamount1"
            value={form.paymentAmount1}
            inputMode="decimal"
            onChange={(e) => set('paymentAmount1', e.target.value)}
          />
        </Field>

        <Field label="Payment method 2:" width="lg">
          <Select
            instanceId="batch-paymethod2"
            size="sm"
            options={payMethodOptions(adminCountry)}
            value={form.paymentMethod2}
            onChange={(v) => set('paymentMethod2', v)}
            error={errors.paymentMethod2}
          />
        </Field>
        <Field label="Amount:" htmlFor="batch-payamount2">
          <Input
            id="batch-payamount2"
            value={form.paymentAmount2}
            inputMode="decimal"
            onChange={(e) => set('paymentAmount2', e.target.value)}
          />
        </Field>

        <Field label="Price Total:" htmlFor="batch-pricetotal" hint="Leave blank to use the calculated total.">
          <Input
            id="batch-pricetotal"
            value={form.priceTotal}
            inputMode="decimal"
            onChange={(e) => set('priceTotal', e.target.value)}
          />
        </Field>

        <Field label="Notifications:" width="lg">
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
    </fieldset>
  );
}
