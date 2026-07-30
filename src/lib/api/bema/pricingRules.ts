import { apiDelete, apiGet, apiPost } from '../http';

export function listPricingRules<TRule>(userId: string, activeOnly: boolean) {
  const qs = new URLSearchParams(activeOnly ? { activeOnly: 'true' } : {});
  return apiGet<{ rules: TRule[] }>(`/api/bema/users/${userId}/pricing-rules?${qs.toString()}`);
}

export function createPricingRule(userId: string, payload: unknown) {
  return apiPost(`/api/bema/users/${userId}/pricing-rules`, payload);
}

export function deletePricingRule(userId: string, ruleId: string) {
  return apiDelete(`/api/bema/users/${userId}/pricing-rules/${ruleId}`);
}
