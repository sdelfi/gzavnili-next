'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

// Ports the pricing/ETA logic that used to live server-side in
// `../http/views/homecals.cfm` (GET-param driven, re-rendered by ColdFusion on every submit —
// see PROGRESS.md for how {CALCULATOR} gets substituted into the real page content).
// English branch only; rates/thresholds copied as-is from the legacy file.
type WeightUnit = 'lb' | 'kg';
type SizeUnit = 'in' | 'cm';
type Service = 'regular' | 'express';
type ParcelType = 'online' | 'personal';

const WEIGHT_UNITS = [
  { value: 'lb', label: 'lb' },
  { value: 'kg', label: 'kg' },
];

const SIZE_UNITS = [
  { value: 'in', label: 'in' },
  { value: 'cm', label: 'cm' },
];

const SERVICES = [{ value: 'regular', label: 'Regular Service' }];

const PARCEL_TYPES = [
  { value: 'online', label: 'Online' },
  { value: 'personal', label: 'Personal' },
];

const DAYS = [
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
  { value: '7', label: 'Sunday' },
];

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

function computeEta(day: string, service: Service): string | null {
  if (!day) return null;
  const d = Number(day);
  if (service === 'express') {
    if (d === 6 || d === 7) return 'Wednesday';
    if (d === 1 || d === 2) return 'Friday';
    if (d === 3 || d === 4 || d === 5) return 'Monday';
  } else {
    if (d === 5 || d === 6) return 'Friday';
    if (d === 7 || d === 1) return 'Monday';
    if (d === 2 || d === 3 || d === 4) return 'Wednesday';
  }
  return null;
}

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function Calculator() {
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('lb');
  const [length, setLength] = useState('');
  const [height, setHeight] = useState('');
  const [width, setWidth] = useState('');
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>('in');
  const [service, setService] = useState<Service | ''>('');
  const [parcelType, setParcelType] = useState<ParcelType | ''>('');
  const [day, setDay] = useState('');
  const [result, setResult] = useState<{ price: number; eta: string | null } | null>(null);
  const [errors, setErrors] = useState<{ service?: string; parcelType?: string }>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Mirrors jquery.validate's default `required` message, since that's what the legacy
    // `../http/views/homecals.cfm` form used (`jQuery('.pricecalc_form').validate();`) — a
    // <label class="error"> next to the field, not a native HTML5 validation bubble.
    setErrors({
      service: service ? undefined : 'This field is required.',
      parcelType: parcelType ? undefined : 'This field is required.',
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
    setResult({ price, eta: computeEta(day, service) });
  };

  return (
    <form className="form pricecalc_form" onSubmit={handleSubmit} noValidate>
      <div className="row">
        <div className="input-group col col-9">
          <Input
            type="text"
            id="calc-weight"
            placeholder="Weight"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
        <div className="input-group col col-3">
          <Select
            instanceId="cal_weighttype"
            options={WEIGHT_UNITS}
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
            placeholder="Length"
            value={length}
            onChange={(e) => setLength(e.target.value)}
          />
        </div>
        <div className="input-group col col-3">
          <Input
            type="text"
            id="calc-height"
            placeholder="Height"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        </div>
        <div className="input-group col col-3">
          <Input
            type="text"
            id="calc-width"
            placeholder="Width"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
          />
        </div>
        <div className="input-group col col-3">
          <Select
            instanceId="cal_type"
            options={SIZE_UNITS}
            value={sizeUnit}
            onChange={(v) => setSizeUnit(v as SizeUnit)}
          />
        </div>
      </div>
      <div className="input-group">
        <Select
          instanceId="cal_service"
          required
          placeholder="Choose Service Type"
          options={SERVICES}
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
          placeholder="Choose Parcel Type"
          options={PARCEL_TYPES}
          value={parcelType}
          onChange={(v) => {
            setParcelType(v as ParcelType);
            setErrors((prev) => ({ ...prev, parcelType: undefined }));
          }}
          error={errors.parcelType}
        />
      </div>
      <div className="input-group">
        <Select instanceId="cal_day" placeholder="Received in USA Day" options={DAYS} value={day} onChange={setDay} />
      </div>
      <div className="btn-block">
        <button type="submit" className="btn btn-blue">
          Calculate <i className="icon icon-arr2"></i>
        </button>
      </div>

      {result && (
        <div className="btn-block">
          <h4 className="w-100">
            Estimated Charge: {currency.format(result.price)}
            {result.eta && (
              <>
                <br />
                Estimated delivery: {result.eta}
              </>
            )}
          </h4>
        </div>
      )}
    </form>
  );
}
