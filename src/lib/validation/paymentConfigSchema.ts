import { z } from 'zod';

// bema "Payment Preferences" (legacy `bema/config/payment.cfm`). Unlike Site Settings'
// `ValidationBean` (which never registers a single rule), this screen's
// `PaymentConfigFormValidation.cfc` runs real required/max-length checks — ported here for
// the six fields the live view actually collects (`vwPaymentConfigForm.cfm`'s PayPal/
// PayFlowPro/Sage gateway blocks, the Payment Methods/Credit Card Types/State Taxes/Fees
// sections, and the second "Paypal Express Checkout" enable toggle are all HTML-commented-out
// — not reachable through the UI at all — see docs/decisions/0020-payment-config.md).
//
// Legacy validates each field's *trimmed* length but stores the *raw*, untrimmed value
// (`this.authorizenet_merchant_username = arguments.authorizenet_merchant_username`, no
// `trim()`) — reproduced here as a trimmed-non-empty check with the raw string passed through
// unchanged, not `.trim()`-ed before storage.
function required(label: string, max: number) {
  return z
    .string()
    .refine((v) => v.trim().length > 0, `${label} is required.`)
    .refine((v) => v.length <= max, `${label} is too long (max ${max} characters).`);
}

export const paymentConfigSchema = z.object({
  // Authorize.Net (AIM) — the only gateway the live `<select>` can actually submit (its one
  // `<option>`). `PaymentConfigFormValidation`'s `paypal`/`payflowpro`/`sage` branches are
  // real code but unreachable through this UI, since no control can ever set `gateway` to
  // anything else — not ported, see docs/decisions/0020-payment-config.md.
  gatewayLogin: required('API Login', 100),
  gatewayTransKey: required('API Transaction Key', 100),

  // Paypal Express Checkout — always required in practice, since the `paypal_enabled` hidden
  // input is permanently `"true"` with no live control to disable it.
  paypalUserId: required('Paypal API Username', 50),
  paypalPassword: required('Paypal API Password', 50),
  paypalTransactionKey: required('Paypal API Transaction Key', 100),
  paypalEmail: required('Paypal Email', 50),
});

export type PaymentConfigInput = z.infer<typeof paymentConfigSchema>;
