'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { submitQuoteForm } from '@/lib/actions/siteForms';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';

const WEIGHT_UNIT_OPTIONS: SelectOption[] = [
  { value: 'lb', label: 'lb' },
  { value: 'kg', label: 'kg' },
  { value: 'g', label: 'g' },
];

function toOptions(values: string[]): SelectOption[] {
  return values.map((value) => ({ value, label: value }));
}

// Legacy `quote_form.cfm`, embedded via the `{QUOTEFORM}` CMS placeholder (currently only
// `cargo.html`) — see PageContent.tsx and docs/decisions/0013-site-pages-cms.md.
export function QuoteForm({ locale }: { locale: string }) {
  const t = useTranslations('QuoteForm');
  const [state, formAction, pending] = useActionState(submitQuoteForm, undefined);
  const fieldErrors = state?.fieldErrors ?? {};

  const freightTypeOptions = toOptions(t.raw('freightTypeOptions'));
  const icotermsOptions = toOptions(t.raw('icotermsOptions'));
  const dimensionOptions = toOptions(t.raw('dimensionOptions'));

  const [freightType, setFreightType] = useState(freightTypeOptions[0].value);
  const [icoterms, setIcoterms] = useState(icotermsOptions[0].value);
  const [weightUnit, setWeightUnit] = useState('lb');
  const [dimensionUnit, setDimensionUnit] = useState(dimensionOptions[0].value);

  if (state?.success) {
    return <h3>{t('thankYou')}</h3>;
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="locale" value={locale} />
      {state?.error && <Alert variant="error">{state.error}</Alert>}

      <div className="row">
        <div className="col col-6">
          <div className="input-group">
            {t('freightType')}
            <Select
              instanceId="quote-freight-type"
              name="freightType"
              options={freightTypeOptions}
              value={freightType}
              onChange={setFreightType}
            />
          </div>
        </div>
        <div className="col col-6">
          <div className="input-group">
            {t('cityOfDeparture')}
            <Input name="cityOfDeparture" required error={fieldErrors.cityOfDeparture?.[0]} />
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col col-9">
          <div className="input-group">
            {t('weight')}
            <Input name="weight" required error={fieldErrors.weight?.[0]} />
          </div>
        </div>
        <div className="col col-3">
          <div className="input-group nolabel">
            <Select
              instanceId="quote-weight-unit"
              name="weightUnit"
              options={WEIGHT_UNIT_OPTIONS}
              value={weightUnit}
              onChange={setWeightUnit}
            />
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col col-6">
          <div className="input-group">
            {t('icoterms')}
            <Select
              instanceId="quote-icoterms"
              name="icoterms"
              options={icotermsOptions}
              value={icoterms}
              onChange={setIcoterms}
            />
          </div>
        </div>
        <div className="col col-6">
          <div className="input-group">
            {t('deliveryCity')}
            <Input name="deliveryCity" required error={fieldErrors.deliveryCity?.[0]} />
          </div>
        </div>
      </div>

      <div className="row row-narrow">
        <div className="col col-3">
          <div className="input-group">
            {t('length')}
            <Input name="length" required error={fieldErrors.length?.[0]} />
          </div>
        </div>
        <div className="col col-3">
          <div className="input-group">
            {t('height')}
            <Input name="height" required error={fieldErrors.height?.[0]} />
          </div>
        </div>
        <div className="col col-3">
          <div className="input-group">
            {t('width')}
            <Input name="width" required error={fieldErrors.width?.[0]} />
          </div>
        </div>
        <div className="col col-3 nolabel">
          <div className="input-group nolabel">
            <Select
              instanceId="quote-dimension-unit"
              name="dimensionUnit"
              options={dimensionOptions}
              value={dimensionUnit}
              onChange={setDimensionUnit}
            />
          </div>
        </div>
      </div>

      <div className="formline">&nbsp;</div>

      <div className="row">
        <div className="col col-4">
          <div className="input-group">
            {t('name')}
            <Input name="name" required error={fieldErrors.name?.[0]} />
          </div>
          <div className="input-group">
            {t('email')}
            <Input type="email" name="email" required error={fieldErrors.email?.[0]} />
          </div>
        </div>
        <div className="col col-8">
          <div className="input-group">
            {t('message')}
            <textarea rows={5} name="message" />
          </div>
        </div>
      </div>

      <div className="btn-block">
        <button type="submit" className="btn btn-blue" disabled={pending}>
          {pending ? '…' : t('send')}
        </button>
      </div>
    </form>
  );
}
