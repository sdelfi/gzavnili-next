// "Add Online Parcel"'s live price calculator — ported from `parcels-online-add-2.js`'s
// `calcDebt()`. Independent of `src/lib/parcels/pricing.ts`/`batchPricing.ts` (the
// PricingRule-based per-kg schedule the batch "Add Parcel" screen uses) — this screen never
// looks at `CustomerPricingRule` at all; it always uses `Config.declaredPrice`/
// `nonDeclaredPrice` (Regular) or the hardcoded 7x/3.5x multipliers (Express/Cargo). Two
// completely separate pricing mechanisms in legacy; kept separate here too. See
// docs/decisions/0022-parcels-online-add.md.
export type OnlineService = 'Regular' | 'Express' | 'Cargo';

export type OnlineDebtInput = {
  /** Raw `#weight` field value; `NaN`/blank is treated as 0, same as `parseFloat` + the JS's
   *  own `isNaN` guard, and then clamped up to the 0.2kg floor either way. */
  weight: number;
  length: number;
  width: number;
  high: number;
  service: OnlineService;
  /** `Config.declaredPrice`/`nonDeclaredPrice` — only consulted for `service === 'Regular'`. */
  declaredPrice: number;
  nonDeclaredPrice: number;
  /** `window.pexists` — true only immediately after a tracking-number lookup found an
   *  existing, upgradable parcel. Always false for a brand-new parcel. */
  pexists: boolean;
  /** `!(contents.trim() === '' && value.trim() === '')` — whether the looked-up parcel (if
   *  any) already had declared customs contents/value on file. Irrelevant when `pexists` is
   *  false (a new parcel always has neither). */
  hasDeclaredContentsOrValue: boolean;
};

export type OnlineDebtResult = {
  /** What the "Dim Weight" field itself displays — `(l × w × h) / 366`, rounded to 4 decimals. */
  dimWeight: number;
  debt: number;
};

/** `(length × width × high) / 366`, rounded to 4 decimals — the same expression `calcDebt()`
 *  computes and writes into the `#dimweight` field on every weight/dimension change. */
export function calculateOnlineDimWeight(length: number, width: number, high: number): number {
  const l = Number.isFinite(length) ? length : 0;
  const w = Number.isFinite(width) ? width : 0;
  const h = Number.isFinite(high) ? high : 0;
  return Number(((l * h * w) / 366).toFixed(4));
}

/** Ported 1:1 from `calcDebt()`, including two legacy quirks kept deliberately, not "fixed":
 *
 *  1. When the dimensional weight exceeds the actual weight, legacy swaps it in via
 *     `formatNumber()` — which rounds to *2* decimals, not the 4 decimals the Dim Weight field
 *     itself displays. The number used for pricing and the number shown on screen can
 *     genuinely differ in their last two decimal places. Reproduced: `dimWeight` (the return
 *     value / field display) keeps 4-decimal rounding; the internal weight used for the debt
 *     calculation below uses 2-decimal rounding when it's the dimensional weight that wins.
 *  2. The delivery-method radios (Pickup/Delivery/Region) have **zero** effect on price.
 *     Legacy's own fee add-on check is `jQuery('[name=sdelivery]:selected')` — `:selected` is
 *     a jQuery pseudo-class that only ever matches `<option>` elements inside a `<select>`;
 *     `sdelivery` is rendered as radio `<input>`s, so that selector is always an empty set and
 *     the `+2.25` (Region) / `+1.25` (Delivery) branches never run, for any delivery method.
 *     Confirmed by reading the exact selector, not assumed — see docs/findings.md. Not
 *     reproduced as a delivery parameter here at all, since there is no delivery-dependent
 *     branch to call.
 */
export function calculateOnlineDebt(input: OnlineDebtInput): OnlineDebtResult {
  const rawWeight = Number.isFinite(input.weight) ? input.weight : 0;
  let t = rawWeight < 0.2 ? 0.2 : rawWeight;

  const l = Number.isFinite(input.length) ? input.length : 0;
  const w = Number.isFinite(input.width) ? input.width : 0;
  const h = Number.isFinite(input.high) ? input.high : 0;
  const d = (l * h * w) / 366;

  const dimWeight = Number(d.toFixed(4));

  if (d > t) {
    t = Math.round(d * 100) / 100;
  }

  if (input.service === 'Regular') {
    const useNonDeclared = !input.pexists || !input.hasDeclaredContentsOrValue;
    t = t * (useNonDeclared ? input.nonDeclaredPrice : input.declaredPrice);
  } else if (input.service === 'Express') {
    t = t * 7;
  } else if (input.service === 'Cargo') {
    t = t * 3.5;
  }

  return { dimWeight, debt: Number(t.toFixed(4)) };
}
