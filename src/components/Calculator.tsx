'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Icon } from '@/components/ui/Icon';

// Ports the pricing/ETA logic that used to live server-side in
// `../http/views/homecals.cfm` (GET-param driven, re-rendered by ColdFusion on every submit —
// see PROGRESS.md for how {CALCULATOR} gets substituted into the real page content).
// Rates/thresholds copied as-is from the legacy file (same for both language branches there).
type WeightUnit = 'lb' | 'kg';
type SizeUnit = 'in' | 'cm';
type Service = 'regular' | 'express';
type ParcelType = 'online' | 'personal';

function computePrice(
  weight: number,
  length: number,
  height: number,
  width: number,
  weightUnit: WeightUnit,
  sizeUnit: SizeUnit,
  service: Service,
  parcelType: ParcelType,
): number {
  let tweight = 0;
  let aweight = weight;

  if (sizeUnit === 'cm') tweight = (length * height * width) / 6000;
  if (sizeUnit === 'in') tweight = (length * height * width) / 366;
  if (weightUnit === 'lb') tweight *= 2.2;
  if (tweight > aweight) aweight = tweight;

  let price = 0;
  if (weightUnit === 'lb') {
    if (aweight < 0.44) aweight = 0.44;
    if (service === 'regular') {
      price = aweight * 3.6;
      if (parcelType === 'personal' && aweight < 13.23) price = aweight * 2.7;
    }
    if (service === 'express') price = aweight * 3.15;
  } else {
    if (aweight < 0.2) aweight = 0.2;
    if (service === 'regular') {
      price = aweight * 8;
      if (parcelType === 'personal' && aweight < 6) price = aweight * 6;
    }
    if (service === 'express') price = aweight * 7;
  }
  return price;
}

// Returns a 1 (Monday) - 7 (Sunday) day index, matching the `Calculator.days` translation
// array's order, or null. Kept as data (not a translated string) so the caller can look up
// the label in whichever locale is active.
function computeEtaDayIndex(day: string, service: Service): number | null {
  if (!day) return null;
  const d = Number(day);
  if (service === 'express') {
    if (d === 6 || d === 7) return 3;
    if (d === 1 || d === 2) return 5;
    if (d === 3 || d === 4 || d === 5) return 1;
  } else {
    if (d === 5 || d === 6) return 5;
    if (d === 7 || d === 1) return 1;
    if (d === 2 || d === 3 || d === 4) return 3;
  }
  return null;
}

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function Calculator() {
  const t = useTranslations('Calculator');
  const dayLabels = t.raw('days') as string[];

  const weightUnits = [
    { value: 'lb', label: t('lb') },
    { value: 'kg', label: t('kg') },
  ];
  const sizeUnits = [
    { value: 'in', label: t('in') },
    { value: 'cm', label: t('cm') },
  ];
  const services = [{ value: 'regular', label: t('regularService') }];
  const parcelTypes = [
    { value: 'online', label: t('online') },
    { value: 'personal', label: t('personal') },
  ];
  const days = dayLabels.map((label, i) => ({ value: String(i + 1), label }));

  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('lb');
  const [length, setLength] = useState('');
  const [height, setHeight] = useState('');
  const [width, setWidth] = useState('');
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>('in');
  const [service, setService] = useState<Service | ''>('');
  const [parcelType, setParcelType] = useState<ParcelType | ''>('');
  const [day, setDay] = useState('');
  const [result, setResult] = useState<{ price: number; etaDayIndex: number | null } | null>(null);
  const [errors, setErrors] = useState<{ service?: string; parcelType?: string }>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Mirrors jquery.validate's default `required` message, since that's what the legacy
    // `../http/views/homecals.cfm` form used (`jQuery('.pricecalc_form').validate();`) — a
    // <label class="error"> next to the field, not a native HTML5 validation bubble.
    const requiredMessage = t('requiredField');
    setErrors({
      service: service ? undefined : requiredMessage,
      parcelType: parcelType ? undefined : requiredMessage,
    });
    if (!service || !parcelType) return;

    const price = computePrice(
      Number(weight) || 0,
      Number(length) || 0,
      Number(height) || 0,
      Number(width) || 0,
      weightUnit,
      sizeUnit,
      service,
      parcelType,
    );
    setResult({ price, etaDayIndex: computeEtaDayIndex(day, service) });
  };

  return (
    <form className="form pricecalc_form" onSubmit={handleSubmit} noValidate>
      <div className="row">
        <div className="input-group col col-9">
          <Input
            type="text"
            id="calc-weight"
            placeholder={t('weightPlaceholder')}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
        <div className="input-group col col-3">
          <Select
            instanceId="cal_weighttype"
            options={weightUnits}
            value={weightUnit}
            onChange={(v) => setWeightUnit(v as WeightUnit)}
          />
        </div>
      </div>
      <div className="row">
        <div className="input-group col col-3">
          <Input
            type="text"
            id="calc-length"
            placeholder={t('lengthPlaceholder')}
            value={length}
            onChange={(e) => setLength(e.target.value)}
          />
        </div>
        <div className="input-group col col-3">
          <Input
            type="text"
            id="calc-height"
            placeholder={t('heightPlaceholder')}
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        </div>
        <div className="input-group col col-3">
          <Input
            type="text"
            id="calc-width"
            placeholder={t('widthPlaceholder')}
            value={width}
            onChange={(e) => setWidth(e.target.value)}
          />
        </div>
        <div className="input-group col col-3">
          <Select
            instanceId="cal_type"
            options={sizeUnits}
            value={sizeUnit}
            onChange={(v) => setSizeUnit(v as SizeUnit)}
          />
        </div>
      </div>
      <div className="input-group">
        <Select
          instanceId="cal_service"
          required
          placeholder={t('chooseServiceType')}
          options={services}
          value={service}
          onChange={(v) => {
            setService(v as Service);
            setErrors((prev) => ({ ...prev, service: undefined }));
          }}
          error={errors.service}
        />
      </div>
      <div className="input-group">
        <Select
          instanceId="cal_ptype"
          required
          placeholder={t('chooseParcelType')}
          options={parcelTypes}
          value={parcelType}
          onChange={(v) => {
            setParcelType(v as ParcelType);
            setErrors((prev) => ({ ...prev, parcelType: undefined }));
          }}
          error={errors.parcelType}
        />
      </div>
      <div className="input-group">
        <Select instanceId="cal_day" placeholder={t('receivedInUsaDay')} options={days} value={day} onChange={setDay} />
      </div>
      <div className="btn-block">
        <button type="submit" className="btn btn-blue">
          {t('calculate')} <Icon name="arr2" inButton />
        </button>
      </div>

      {result && (
        <div className="btn-block">
          <h4 className="w-100">
            {t('estimatedCharge')}: {currency.format(result.price)}
            {result.etaDayIndex !== null && (
              <>
                <br />
                {t('estimatedDelivery')}: {dayLabels[result.etaDayIndex - 1]}
              </>
            )}
          </h4>
        </div>
      )}
    </form>
  );
}
