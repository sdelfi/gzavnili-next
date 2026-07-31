'use client';

import { useEffect, useState } from 'react';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { payMethodOptions } from '@/lib/parcels/constants';
import { calculateParcelPrice, dimensionalWeight, type PricingRule } from '@/lib/parcels/pricing';
import { listPricingRules } from '@/lib/api/bema/pricingRules';
import type { ParcelFormState } from '@/lib/parcels/form';
import s from './ParcelPricingSection.module.css';

// "Miscellaneous Info" in legacy — in practice the measure-and-charge section: dimensions in,
// price out, then how it was paid. Ported from that fieldset in
// views/parcels/vwParcelsUpdate.cfm plus its `goWeight()` handler.
//
// Legacy recalculates the amount on every keystroke in weight/dimensions and silently
// overwrites whatever the operator typed into Amount. That loses hand-set prices, so here
// the suggestion is computed and shown, and applied by pressing "Use". Dimensional weight is
// still filled in automatically — it's derived from the three dimensions with no judgement
// involved.

const num = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export function ParcelPricingSection({
  form,
  set,
  errors,
  adminCountry,
  isPaid,
}: {
  form: ParcelFormState;
  set: <K extends keyof ParcelFormState>(key: K, value: ParcelFormState[K]) => void;
  errors: Record<string, string>;
  adminCountry: string | null;
  /** Trigger-derived: decides whether this parcel can be marked paid, or unpaid. */
  isPaid: boolean;
}) {
  // Kept together with the customer they belong to; rules for the previous customer must
  // never be used to price this one.
  const [loaded, setLoaded] = useState<{ userId: string; rules: PricingRule[] }>({ userId: '', rules: [] });

  const userId = form.userId;
  const rules = loaded.userId === userId ? loaded.rules : [];

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    listPricingRules<PricingRule>(userId, true)
      .then((data) => !cancelled && setLoaded({ userId, rules: data.rules }))
      .catch(() => !cancelled && setLoaded({ userId, rules: [] }));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /** Dimensional weight is a pure function of the three dimensions, so it is recomputed by
   *  whichever of them changed rather than synced back in an effect — legacy fills it in the
   *  same way, and there is nothing here for an operator to disagree with. */
  function setDimension(key: 'length' | 'width' | 'high', value: string) {
    const next = { length: form.length, width: form.width, high: form.high, [key]: value };
    set(key, value);
    const derived = dimensionalWeight(num(next.length), num(next.width), num(next.high));
    set('dimWeight', derived > 0 ? derived.toFixed(2) : '');
  }

  const suggestion = calculateParcelPrice({
    service: form.service,
    weight: num(form.weight),
    dimWeight: num(form.dimWeight),
    rules,
  });
  const suggestedAmount = suggestion.amount.toFixed(2);
  // Compared numerically: `58` and `58.00` are the same price, and offering to "fix" one
  // into the other would just be noise.
  const matchesSuggestion = form.debt !== '' && num(form.debt).toFixed(2) === suggestedAmount;

  const partialAmount = num(form.payAmount2);

  return (
    <fieldset className={s.section}>
      <legend className={s.legend}>Measurements &amp; Payment</legend>

      <div className={s.grid}>
        <Field label="Weight:" htmlFor="parcel-weight">
          <Input
            id="parcel-weight"
            value={form.weight}
            inputMode="decimal"
            onChange={(e) => set('weight', e.target.value)}
            error={errors.weight}
          />
        </Field>
        <Field label="Value:" htmlFor="parcel-value">
          <Input
            id="parcel-value"
            value={form.value}
            inputMode="decimal"
            onChange={(e) => set('value', e.target.value)}
            error={errors.value}
          />
        </Field>

        <Field label="Length:" htmlFor="parcel-length" width="sm">
          <Input
            id="parcel-length"
            value={form.length}
            inputMode="decimal"
            onChange={(e) => setDimension('length', e.target.value)}
          />
        </Field>
        <Field label="Width:" htmlFor="parcel-width" width="sm">
          <Input
            id="parcel-width"
            value={form.width}
            inputMode="decimal"
            onChange={(e) => setDimension('width', e.target.value)}
          />
        </Field>
        <Field label="High:" htmlFor="parcel-high" width="sm">
          <Input
            id="parcel-high"
            value={form.high}
            inputMode="decimal"
            onChange={(e) => setDimension('high', e.target.value)}
          />
        </Field>
        <Field label="Dim Weight:" htmlFor="parcel-dimweight" width="sm" hint="L × W × H ÷ 366">
          <Input id="parcel-dimweight" value={form.dimWeight} readOnly />
        </Field>

        <Field label="Amount:" htmlFor="parcel-debt">
          <Input
            id="parcel-debt"
            value={form.debt}
            inputMode="decimal"
            onChange={(e) => set('debt', e.target.value)}
            error={errors.debt}
          />
        </Field>

        <div className={s.suggestion}>
          <span className={s.suggestionText}>
            Suggested: <b>{suggestedAmount}</b> — {suggestion.explanation}
          </span>
          {!matchesSuggestion && (
            <Button type="button" variant="secondary" onClick={() => set('debt', suggestedAmount)}>
              Use
            </Button>
          )}
        </div>
      </div>

      <div className={s.grid}>
        <Field label="Partial paid:" htmlFor="parcel-payamount2">
          <Input
            id="parcel-payamount2"
            value={form.payAmount2}
            inputMode="decimal"
            onChange={(e) => set('payAmount2', e.target.value)}
          />
        </Field>

        {partialAmount > 0 && (
          <Field label="Partial payment method:" width="lg">
            <Select
              instanceId="parcel-paymethod2"
              size="sm"
              options={payMethodOptions(adminCountry)}
              value={form.payMethod2}
              onChange={(value) => set('payMethod2', value)}
              error={errors.payMethod2}
            />
          </Field>
        )}

        {/* Marking paid raises an invoice and a payment; marking unpaid reverses them. Only
            one of the two is ever available, decided by the parcel's current state — legacy
            renders the other as a disabled checkbox, which reads as "you can't do this here"
            rather than "this doesn't apply". */}
        <Field label=" " width="lg">
          {isPaid ? (
            <Checkbox
              label="Mark as unpaid"
              checked={form.markUnpaid}
              onChange={(e) => set('markUnpaid', e.target.checked)}
            />
          ) : (
            <Checkbox
              label="Mark as paid"
              checked={form.markPaid}
              onChange={(e) => set('markPaid', e.target.checked)}
            />
          )}
        </Field>

        {form.markPaid && (
          <Field label="Payment method:" width="lg">
            <Select
              instanceId="parcel-paymethod1"
              size="sm"
              options={payMethodOptions(adminCountry)}
              value={form.payMethod1}
              onChange={(value) => set('payMethod1', value)}
              error={errors.payMethod1}
            />
          </Field>
        )}
      </div>

      <div className={s.grid}>
        <Field label="Location:" htmlFor="parcel-location">
          <Input id="parcel-location" value={form.location} onChange={(e) => set('location', e.target.value)} />
        </Field>
        <Field label="Group:" htmlFor="parcel-group" width="sm">
          <Input id="parcel-group" value={form.groupId} onChange={(e) => set('groupId', e.target.value)} />
        </Field>
      </div>

      <Field label="Notes:" htmlFor="parcel-notes" width="lg" hint="Required when the weight or amount changes.">
        <Textarea
          id="parcel-notes"
          rows={4}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          error={errors.notes}
        />
      </Field>
    </fieldset>
  );
}
