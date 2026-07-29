"use client";

import { useState } from "react";

// Ports the pricing/ETA logic that used to live server-side in
// `../http/views/homecals.cfm` (GET-param driven, re-rendered by ColdFusion on every submit —
// see PROGRESS.md for how {CALCULATOR} gets substituted into the real page content).
// English branch only; rates/thresholds copied as-is from the legacy file.
type WeightUnit = "lb" | "kg";
type SizeUnit = "in" | "cm";
type Service = "regular" | "express";
type ParcelType = "online" | "personal";

const DAYS = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "7", label: "Sunday" },
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

  if (sizeUnit === "cm") tweight = (length * height * width) / 6000;
  if (sizeUnit === "in") tweight = (length * height * width) / 366;
  if (weightUnit === "lb") tweight *= 2.2;
  if (tweight > aweight) aweight = tweight;

  let price = 0;
  if (weightUnit === "lb") {
    if (aweight < 0.44) aweight = 0.44;
    if (service === "regular") {
      price = aweight * 3.6;
      if (parcelType === "personal" && aweight < 13.23) price = aweight * 2.7;
    }
    if (service === "express") price = aweight * 3.15;
  } else {
    if (aweight < 0.2) aweight = 0.2;
    if (service === "regular") {
      price = aweight * 8;
      if (parcelType === "personal" && aweight < 6) price = aweight * 6;
    }
    if (service === "express") price = aweight * 7;
  }
  return price;
}

function computeEta(day: string, service: Service): string | null {
  if (!day) return null;
  const d = Number(day);
  if (service === "express") {
    if (d === 6 || d === 7) return "Wednesday";
    if (d === 1 || d === 2) return "Friday";
    if (d === 3 || d === 4 || d === 5) return "Monday";
  } else {
    if (d === 5 || d === 6) return "Friday";
    if (d === 7 || d === 1) return "Monday";
    if (d === 2 || d === 3 || d === 4) return "Wednesday";
  }
  return null;
}

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function Calculator() {
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("lb");
  const [length, setLength] = useState("");
  const [height, setHeight] = useState("");
  const [width, setWidth] = useState("");
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>("in");
  const [service, setService] = useState<Service | "">("");
  const [parcelType, setParcelType] = useState<ParcelType | "">("");
  const [day, setDay] = useState("");
  const [result, setResult] = useState<{ price: number; eta: string | null } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
    <form className="form pricecalc_form" onSubmit={handleSubmit}>
      <div className="row">
        <div className="input-group col col-9">
          <input
            type="text"
            id="calc-weight"
            placeholder="Weight"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
        <div className="input-group col col-3">
          <select
            id="cal_weighttype"
            value={weightUnit}
            onChange={(e) => setWeightUnit(e.target.value as WeightUnit)}
          >
            <option value="lb">lb</option>
            <option value="kg">kg</option>
          </select>
        </div>
      </div>
      <div className="row">
        <div className="input-group col col-3">
          <input
            type="text"
            id="calc-length"
            placeholder="Length"
            value={length}
            onChange={(e) => setLength(e.target.value)}
          />
        </div>
        <div className="input-group col col-3">
          <input
            type="text"
            id="calc-height"
            placeholder="Height"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        </div>
        <div className="input-group col col-3">
          <input
            type="text"
            id="calc-width"
            placeholder="Width"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
          />
        </div>
        <div className="input-group col col-3">
          <select id="cal_type" value={sizeUnit} onChange={(e) => setSizeUnit(e.target.value as SizeUnit)}>
            <option value="in">in</option>
            <option value="cm">cm</option>
          </select>
        </div>
      </div>
      <div className="input-group">
        <select
          required
          value={service}
          onChange={(e) => setService(e.target.value as Service)}
        >
          <option value="">Choose Service Type</option>
          <option value="regular">Regular Service</option>
        </select>
      </div>
      <div className="input-group">
        <select
          required
          value={parcelType}
          onChange={(e) => setParcelType(e.target.value as ParcelType)}
        >
          <option value="">Choose Parcel Type</option>
          <option value="online">Online</option>
          <option value="personal">Personal</option>
        </select>
      </div>
      <div className="input-group">
        <select value={day} onChange={(e) => setDay(e.target.value)}>
          <option value="">Received in USA Day</option>
          {DAYS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
      <div className="btn-block">
        <button type="submit" className="btn btn-blue">
          Calculate <i className="icon icon-arr2"></i>
        </button>
      </div>

      {result && (
        <div className="btn-block">
          <h4>
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
