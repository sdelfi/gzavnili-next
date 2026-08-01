import { apiGet, apiPatch } from '../http';

// bema "Payment Preferences" (legacy `bema/config/payment.cfm`) — see
// docs/decisions/0020-payment-config.md for what this covers.
export type PaymentConfig = {
  gatewayLogin: string;
  gatewayTransKey: string;
  paypalUserId: string;
  paypalPassword: string;
  paypalTransactionKey: string;
  paypalEmail: string;
};

export function getPaymentConfig() {
  return apiGet<{ config: PaymentConfig }>('/api/bema/config/payment');
}

export function updatePaymentConfig(payload: PaymentConfig) {
  return apiPatch<{ config: PaymentConfig }>('/api/bema/config/payment', payload);
}
