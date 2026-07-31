import { apiDelete, apiGet, apiPost } from '../http';

export function listPricingRules<TRule>(userId: string) {
  return apiGet<{ rules: TRule[] }>(`/api/bema/users/${userId}/pricing-rules`);
}

export function createPricingRule(userId: string, payload: unknown) {
  return apiPost(`/api/bema/users/${userId}/pricing-rules`, payload);
}

// Soft delete ("Deactivate") — see `[ruleId]/route.ts`'s DELETE handler.
export function deletePricingRule(userId: string, ruleId: string) {
  return apiDelete(`/api/bema/users/${userId}/pricing-rules/${ruleId}`);
}

export function restorePricingRule(userId: string, ruleId: string) {
  return apiPost(`/api/bema/users/${userId}/pricing-rules/${ruleId}/restore`);
}

// "Pricing Rules Administration" (global, cross-customer) — see
// src/app/api/bema/pricing-rules/route.ts.
export type PricingRulesAdminFiltersState = {
  page: number;
  perPage: number;
  serviceType: string;
  mode: string;
  validFromFrom: string;
  validFromTo: string;
  customerId: string;
  customerLabel: string;
  activeOnly: boolean;
};

export const EMPTY_PRICING_RULES_ADMIN_FILTERS: PricingRulesAdminFiltersState = {
  page: 1,
  perPage: 25,
  serviceType: '',
  mode: '',
  validFromFrom: '',
  validFromTo: '',
  customerId: '',
  customerLabel: '',
  activeOnly: true,
};

/** Serialises filter state for both the URL and the API — mirrors `parcelFiltersToQuery`. */
export function pricingRulesAdminFiltersToQuery(filters: PricingRulesAdminFiltersState): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.page !== 1) params.set('page', String(filters.page));
  if (filters.perPage !== 25) params.set('perPage', String(filters.perPage));
  if (filters.serviceType) params.set('serviceType', filters.serviceType);
  if (filters.mode) params.set('mode', filters.mode);
  if (filters.validFromFrom) params.set('validFromFrom', filters.validFromFrom);
  if (filters.validFromTo) params.set('validFromTo', filters.validFromTo);
  if (filters.customerId) {
    params.set('customerId', filters.customerId);
    params.set('customerLabel', filters.customerLabel);
  }
  if (!filters.activeOnly) params.set('activeOnly', 'false');
  return params;
}

/** Inverse of `pricingRulesAdminFiltersToQuery`, for restoring state from the URL on load. */
export function pricingRulesAdminFiltersFromQuery(params: URLSearchParams): PricingRulesAdminFiltersState {
  return {
    ...EMPTY_PRICING_RULES_ADMIN_FILTERS,
    page: Number(params.get('page') ?? 1) || 1,
    perPage: Number(params.get('perPage') ?? 25) || 25,
    serviceType: params.get('serviceType') ?? '',
    mode: params.get('mode') ?? '',
    validFromFrom: params.get('validFromFrom') ?? '',
    validFromTo: params.get('validFromTo') ?? '',
    customerId: params.get('customerId') ?? '',
    customerLabel: params.get('customerLabel') ?? '',
    activeOnly: params.get('activeOnly') !== 'false',
  };
}

export function listAllPricingRules<TRule>(filters: PricingRulesAdminFiltersState) {
  const query = pricingRulesAdminFiltersToQuery(filters);
  // `customerLabel` is round-tripped through the URL for restoring the picker's display
  // text on load; the API itself only cares about `customerId`.
  query.delete('customerLabel');
  return apiGet<{ items: TRule[]; total: number; page: number; perPage: number }>(
    `/api/bema/pricing-rules?${query.toString()}`,
  );
}
