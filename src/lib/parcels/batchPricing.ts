// The batch "Add Parcel" screen's group-delivery-fee and payment-split math, ported from
// `bema/include/js/parcels-add.js`'s `sortParcelsTable()`/`goWeight()` and the POST handler
// in `bema/parcels/parcels-add.cfm` (the percentPay/percentPay2/parcelsAmountTotalPercent
// block). Per-kg base pricing itself is untouched — that's `calculateParcelPrice()` in
// `./pricing.ts`, used identically here and on the edit screen. What's here is specific to
// batch add: several draft parcels for one customer share a "group" (`groupid`), and a
// group's delivery method adds a shared fee split evenly across its parcels, on top of a
// $5-per-group minimum charge.
//
// Ported as pure functions (no React, no fetch) so the arithmetic — the part explicitly
// flagged as needing care — is unit-testable on its own.

import { calculateParcelPrice, type PricingRule } from './pricing';

export type Delivery = 'Pickup' | 'Delivery' | 'Region';

export type DraftParcelCalcInput = {
  id: string;
  groupId: string;
  delivery: Delivery;
  service: string;
  weight: number;
};

export type DraftParcelCalcResult = {
  id: string;
  /** Per-kg price before any group fee — `calculateParcelPrice()`'s suggestion. */
  baseDebt: number;
  /** This item's even share of its group's delivery fee / minimum-charge top-up. */
  increase: number;
  /** `baseDebt + increase`, unscaled — what the price-total override and payment split both
   *  work from, matching legacy using `parcelInfo.debt + parcelInfo.increase` directly rather
   *  than a value already written back to the item. */
  rawTotal: number;
};

export type GroupSummary = {
  groupId: string;
  weight: number;
  /** Rounded to cents, matching the "Group Total" line legacy prints per group. */
  amount: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A group's delivery-method fee, plus the $5 minimum charge — both additive, both computed
 *  from figures legacy takes at face value:
 *  - Pickup adds nothing.
 *  - Delivery adds a flat $5 for the whole group.
 *  - Region adds $5 per started 10kg of the group's total weight.
 *  - Minimum charge compares the group's *pre-fee* debt total (not pre-fee-plus-delivery) to
 *    $5 and tops it up — stacking with the delivery/region fee above rather than being
 *    superseded by it. That looks like it should be an "or", but it isn't in the source, and
 *    a low-value Delivery-type group really does get charged both. */
export function computeGroupIncrease(groupWeight: number, groupBaseAmount: number, delivery: Delivery): number {
  let increase = 0;
  if (delivery === 'Delivery') increase += 5;
  if (delivery === 'Region') increase += Math.ceil(groupWeight / 10) * 5;
  if (groupBaseAmount < 5) increase += 5 - groupBaseAmount;
  return increase;
}

/** Prices every draft parcel (base rate, then its group's fee share) and rolls the groups up
 *  for the on-screen subtotals. All parcels in a group are assumed to share one delivery
 *  method — the UI enforces that before a draft ever reaches here, same as legacy's
 *  `groupidCheck` validator. */
export function computeDraftParcelTotals(
  items: DraftParcelCalcInput[],
  rules: PricingRule[],
): { items: DraftParcelCalcResult[]; groups: GroupSummary[]; grandTotal: { weight: number; amount: number } } {
  const baseDebts = new Map<string, number>();
  for (const item of items) {
    baseDebts.set(item.id, calculateParcelPrice({ service: item.service, weight: item.weight, dimWeight: 0, rules }).amount);
  }

  const groupIds = [...new Set(items.map((i) => i.groupId))];
  const results: DraftParcelCalcResult[] = [];
  const groups: GroupSummary[] = [];

  for (const groupId of groupIds) {
    const groupItems = items.filter((i) => i.groupId === groupId);
    const groupWeight = groupItems.reduce((sum, i) => sum + i.weight, 0);
    const groupBaseAmount = groupItems.reduce((sum, i) => sum + (baseDebts.get(i.id) ?? 0), 0);
    // Every parcel in the group carries the same delivery method (enforced by the UI); the
    // first one's is as good as any.
    const delivery = groupItems[0].delivery;
    const increase = computeGroupIncrease(groupWeight, groupBaseAmount, delivery);
    const perItemIncrease = increase / groupItems.length;

    for (const item of groupItems) {
      const baseDebt = baseDebts.get(item.id) ?? 0;
      results.push({ id: item.id, baseDebt, increase: perItemIncrease, rawTotal: baseDebt + perItemIncrease });
    }

    groups.push({ groupId, weight: round2(groupWeight), amount: round2(groupBaseAmount + increase) });
  }

  const grandTotal = groups.reduce(
    (acc, g) => ({ weight: round2(acc.weight + g.weight), amount: round2(acc.amount + g.amount) }),
    { weight: 0, amount: 0 },
  );

  return { items: results, groups, grandTotal };
}

/** The "Price Total" override: left blank (or matching the calculated total) is a no-op;
 *  set to anything else scales every parcel proportionally. Ported from
 *  `parcelsAmountTotalPercent`. */
export function priceOverrideScale(rawGrandTotal: number, priceTotalOverride: number | null): number {
  if (priceTotalOverride === null || rawGrandTotal === 0 || priceTotalOverride === rawGrandTotal) return 1;
  return priceTotalOverride / rawGrandTotal;
}

/** The amount actually stored on the parcel — `rawTotal` scaled by the price-total override,
 *  rounded to cents. */
export function finalDebt(rawTotal: number, scale: number): number {
  return round2(rawTotal * scale);
}

/** Splits the two payment-method amounts (entered once, for the whole batch) across parcels
 *  proportionally to each parcel's *unscaled* share of the total — legacy computes
 *  `payAmount1`/`payAmount2` from `parcelInfo.debt + parcelInfo.increase` before the
 *  price-total override is applied to `form.debt`, so a Price Total override changes what
 *  gets charged without changing how the payment amounts are split. Preserved as found. */
export function paymentSplit(
  rawTotal: number,
  rawGrandTotal: number,
  paymentAmount1: number,
  paymentAmount2: number,
): { payAmount1: number; payAmount2: number } {
  if (rawGrandTotal === 0) return { payAmount1: 0, payAmount2: 0 };
  const percentPay = (paymentAmount1 * 100) / rawGrandTotal;
  const percentPay2 = (paymentAmount2 * 100) / rawGrandTotal;
  return {
    payAmount1: round2((rawTotal * percentPay) / 100),
    payAmount2: round2((rawTotal * percentPay2) / 100),
  };
}
