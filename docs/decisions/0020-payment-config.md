# 0020 — Payment Preferences (bema "Payment Setup")

## Investigation

Porting legacy `bema/config/payment.cfm` + `views/config/vwPaymentConfigForm.cfm`, the bema
"Payment Preferences" screen. It backs the same singleton `config` table row as Site Settings
(`docs/decisions/0014-site-popup.md`'s / this repo's `Config` model) — `MSSQLPaymentDAO.
retrievePaymentConfig()` is a second `SELECT ... FROM config`, not a separate table.

**Most of the legacy view is HTML-commented-out, not live.** Reading `vwPaymentConfigForm.cfm`
top to bottom:

- The "Credit Card Gateway Configuration" `<select name="gateway">` has exactly **one**
  `<option value="authorizenet">` — there is no way for any operator to submit any other
  gateway value through this UI, ever.
- The PayPal/PayFlowPro/Sage `<tbody>` blocks (their own username/password/transaction-key/
  other fields) are wrapped in one long `<!--- ... --->` comment, immediately following the
  live Authorize.Net block. Dead.
- A "Paypal Express Checkout" table (`paypal_username`/`paypal_password`/
  `paypal_transaction_key`/`paypal_email`) appears live, right after — this is the one that
  actually renders.
- Everything from the (commented-out) Cybersource block onward — Payment Methods checklist,
  Credit Card Types checklist, a *second*, duplicate "Paypal Express Checkout" section with
  its own enable/disable checkbox, State Taxes table, and Fees (amount/type) — is one single
  `<!--- ... --->` block running to just above the Save/Cancel buttons. All dead.
- In their place, four **hidden** inputs pin those settings to fixed values on every submit:
  `payment_methods=CREDITCARD`, `card_types=VISA,MASTERCARD,DISCOVER,AMEX`, `fee_amount=0`,
  `fee_type=$`, `paypal_enabled=true`. No control anywhere can change them.

`PaymentConfigFormValidation.cfc` is real, actively-run validation (unlike `settings.cfm`'s
inert `ValidationBean`) — but since `gateway`/`payment_methods`/`card_types`/`fee_amount`/
`fee_type`/`paypal_enabled` can only ever hold their one fixed value through this UI, only the
Authorize.Net-branch and PayPal-Express-required checks are ever actually exercised. See
`docs/findings.md`'s "Payment Preferences" section for the full trace, including a genuinely
destructive bug this surfaced in `MSSQLPaymentDAO.updatePaymentConfig()`.

## Implementation

Only what the live view actually collects is built:

- `Config` gained `gateway`, `gatewayLogin` (`GatewayLogin`/API Login), `gatewayTransKey`
  (`GatewayTransKey`/API Transaction Key), `paypalUserId`, `paypalPassword`,
  `paypalTransactionKey`, `paypalEmail`.
- `paymentConfigSchema` ports `PaymentConfigFormValidation`'s real required+max-length rules
  for those six editable fields (validates the *trimmed* length, stores the *raw* value —
  matching legacy exactly, not `.trim()`-ing before persisting).
- `GET`/`PATCH /api/bema/config/payment`, gated `BemaAdministrator` (legacy:
  `WEBSITE_ADMINISTRATOR,ADMINISTRATOR`, same gate as Site Settings — this schema has no
  separate "website administrator" role). `PATCH` always writes `gateway: "authorizenet"`
  server-side, the only value the UI can ever produce.
- `PaymentConfigForm` (`src/components/admin/PaymentConfigForm/`) renders a disabled
  single-option Gateway select (matching the legacy dropdown having exactly one real choice),
  the two Authorize.Net fields, and the four Paypal Express Checkout fields — the same set
  `vwPaymentConfigForm.cfm` actually renders once the dead code is set aside. Reachable at
  `/bema/payment` (`routes.bema.paymentConfig()`), wired to the pre-existing "Payment Setup"
  placeholder nav entry in the Sidebar's CONFIGURATION group.

## What wasn't ported, and why

- **`GatewayPassword`/`GatewayOther`** (legacy `merchantPassword`/`merchantOther`): the
  Authorize.Net branch — the only branch any real request ever takes — never calls
  `setMerchantPassword`/`setMerchantOther`, so these two columns just get read back and
  rewritten unchanged on every save; no live path ever puts a real value into them. Not
  modeled. See `docs/findings.md`.
- **PayPal/PayFlowPro/Sage merchant gateway credentials**: dead UI, unreachable branches
  (`gateway` can never hold those values through this screen). Not modeled.
- **`feeAmount`/`feeType`/`paypalEnabled`**: hidden inputs with no live control, always
  `0`/`"$"`/`true`. Not stored as columns at all — a value that can never vary carries no
  admin-set state to persist; the API route just always writes the same literals legacy's
  hidden inputs always send. See `docs/findings.md`.
- **Payment Methods / Credit Card Types / their `paymentmethods` table, including
  per-method `CheckoutDescription`**: open, needs a decision — see `docs/findings.md`. In
  short, the only write path (`updatePaymentConfig`) does a blind `DELETE FROM paymentmethods`
  then re-inserts only the two hardcoded lists, and the per-description save loop
  (`payment.cfm`'s `for key in paymentMethods: updatePaymentDescription(key, form['pay_#key#']
  ?? '')`) always writes blank since the description textareas are dead code with no
  corresponding form fields — meaning **every legacy "Save" on this screen destroys any
  payment-method descriptions and any non-`CREDITCARD` payment method that might exist**.
  Nothing in `gzavnili-next` reads a payment-methods table yet (no checkout/orders domain is
  built), so reproducing this would mean inventing a relational table solely to immediately
  wipe it on every edit — deferred rather than built speculatively.
- **State Taxes**: same reasoning — dead UI, and the hidden `taxes` input always submits `[]`,
  so the only observable behavior of the live screen is "delete all existing tax rows." Not
  modeled; no `taxes` table exists in this schema.
