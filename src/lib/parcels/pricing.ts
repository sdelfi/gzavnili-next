// The parcel form's automatic price ("Amount") calculation, ported from the legacy parcel
// form's `goWeight()` (views/parcels/vwParcelsUpdate.cfm) and `include/js/PricingHelper.js`.
//
// Two layers, in this order — same as legacy:
//  1. A customer-specific pricing rule (`customer_pricing_rules`, the "Custom Rates &
//     Discounts" section of the customer screen), if one is active today for this service.
//  2. Otherwise the per-service default schedule below.
//
// It runs client-side because it has to update the Amount field as the operator types a
// weight, and because the operator can always overwrite the result — it is a suggestion, not
// a computed column. The rules it reads come from the existing
// `/api/bema/users/:id/pricing-rules` endpoint.

export type PricingRule = {
  id: string;
  serviceType: 'Regular' | 'Express' | 'Cargo';
  mode: 'FixedPrice' | 'Discount';
  value: string | number;
  validFrom: string;
  validTo: string | null;
  notes: string | null;
  // Soft-delete flag — a deactivated rule must never apply to a price calculation even if its
  // date range would otherwise match. See docs/findings.md's "Customer Pricing Rules" entry.
  isActive: boolean;
};

export type PriceResult = {
  amount: number;
  /** What produced the figure, shown under the Amount field so it isn't a magic number. */
  explanation: string;
};

// Legacy `PricingRates`. `MR_REGULAR_RATE` (8.5) applies to one agent prefix and is not
// modelled here — see the note in docs/decisions/0015 about `agentPrefix` being dead in the
// list query; it survives only in this rate table, with no code left that sets `userPref`.
const DEFAULT_REGULAR_RATE = 9.0;
const DEFAULT_EXPRESS_RATE = 8.5;

function defaultRate(service: string): number {
  return service === 'Express' || service === 'Cargo' ? DEFAULT_EXPRESS_RATE : DEFAULT_REGULAR_RATE;
}

/** Volumetric weight: length × width × height ÷ 366 (inches → kg), legacy's divisor. */
export function dimensionalWeight(length: number, width: number, high: number): number {
  return (length * width * high) / 366;
}

/** The legacy per-service default schedule from `goWeight()`'s `calculateDefaultPrice()`.
 *  Note `Regular`'s two branches multiply by the same 8 — the tracking-prefix condition it
 *  tests has no effect. Reproduced as the single rate it actually is. */
function defaultPrice(service: string, billableWeight: number, isDimensional: boolean): PriceResult {
  switch (service) {
    case 'Regular':
      return { amount: billableWeight * 8, explanation: 'Regular — $8.00/kg' };
    case 'Economy':
      return { amount: billableWeight * 7, explanation: 'Philadelphia — $7.00/kg' };
    case 'Express':
      return { amount: billableWeight * 7, explanation: 'Express — $7.00/kg' };
    case 'saveez': {
      const rate = isDimensional ? 5.5 : 5.85;
      return { amount: billableWeight * rate, explanation: `Saveez.com — $${rate.toFixed(2)}/kg` };
    }
    case 'Online': {
      if (isDimensional) return { amount: billableWeight * 7, explanation: 'Online Shopping — $7.00/kg' };
      const rate = billableWeight <= 7 ? 8 : 7;
      return {
        amount: billableWeight * rate,
        explanation: `Online Shopping — $${rate.toFixed(2)}/kg (${billableWeight <= 7 ? 'up to' : 'over'} 7 kg)`,
      };
    }
    default:
      return {
        amount: billableWeight * defaultRate(service),
        explanation: `${service} — $${defaultRate(service).toFixed(2)}/kg`,
      };
  }
}

function activeRule(rules: PricingRule[], service: string, on: Date): PricingRule | null {
  return (
    rules.find((rule) => {
      if (!rule.isActive) return false;
      if (rule.serviceType !== service) return false;
      if (new Date(rule.validFrom) > on) return false;
      if (!rule.validTo) return true;
      // `validTo` is inclusive — a rule ending today still applies for the whole of today.
      const end = new Date(rule.validTo);
      end.setUTCHours(23, 59, 59, 999);
      return on <= end;
    }) ?? null
  );
}

/**
 * Suggested amount for a parcel. `weight` is the scale weight; the dimensional weight wins
 * when it is larger, which is the whole reason the form asks for length/width/height.
 */
export function calculateParcelPrice({
  service,
  weight,
  dimWeight,
  rules,
  now = new Date(),
}: {
  service: string;
  weight: number;
  dimWeight: number;
  rules: PricingRule[];
  now?: Date;
}): PriceResult {
  const billableWeight = dimWeight > weight ? dimWeight : weight;
  const isDimensional = dimWeight > weight;

  const rule = activeRule(rules, service, now);
  if (rule) {
    const value = Number(rule.value);
    if (rule.mode === 'FixedPrice') {
      return {
        amount: value * billableWeight,
        explanation: `Custom rate — $${value.toFixed(2)}/kg${rule.notes ? ` (${rule.notes})` : ''}`,
      };
    }
    const base = defaultRate(service);
    return {
      amount: base * billableWeight * (1 - value / 100),
      explanation: `${value}% discount off $${base.toFixed(2)}/kg${rule.notes ? ` (${rule.notes})` : ''}`,
    };
  }

  const result = defaultPrice(service, billableWeight, isDimensional);
  return {
    ...result,
    explanation: isDimensional
      ? `${result.explanation}, on dimensional weight ${billableWeight.toFixed(2)} kg`
      : result.explanation,
  };
}
