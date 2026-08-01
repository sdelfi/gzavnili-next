'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/admin/Button';
import { ErrorList } from '@/components/ui/admin/Alert';
import { Input } from '@/components/ui/admin/Input';
import { Field } from '@/components/ui/admin/Field';
import { Select } from '@/components/ui/admin/Select';
import { getPaymentConfig, updatePaymentConfig, type PaymentConfig } from '@/lib/api/bema/paymentConfig';
import { ApiError, extractErrorMessages } from '@/lib/api/http';
import s from './PaymentConfigForm.module.css';

const GATEWAY_OPTIONS = [{ value: 'authorizenet', label: 'Authorize.Net (AIM)' }];

// bema "Payment Preferences" (legacy `bema/config/payment.cfm`). Only the fields a live
// control in `vwPaymentConfigForm.cfm` actually collects — see
// docs/decisions/0020-payment-config.md for what's HTML-commented-out in the legacy view
// (PayPal/PayFlowPro/Sage gateway blocks, Payment Methods, Credit Card Types, State Taxes,
// Fees, and a second "Enable Paypal Express Checkout" toggle) and therefore not built here.
export function PaymentConfigForm() {
  const [values, setValues] = useState<PaymentConfig | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getPaymentConfig()
      .then((data) => setValues(data.config))
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load payment preferences.'));
  }, []);

  function set<K extends keyof PaymentConfig>(key: K, value: PaymentConfig[K]) {
    setValues((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values) return;
    setErrors([]);
    setSubmitting(true);
    try {
      const data = await updatePaymentConfig(values);
      setValues(data.config);
      setSaved(true);
    } catch (err) {
      setErrors(err instanceof ApiError ? extractErrorMessages(err.body) : ['Save failed.']);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) return <ErrorList errors={[loadError]} />;
  if (!values) return <div>Loading…</div>;

  return (
    <form className={s.form} onSubmit={handleSubmit}>
      <ErrorList errors={errors} />
      {saved && <p className={s.saved}>Saved.</p>}

      <h2 className={s.heading}>Credit Card Gateway Configuration</h2>
      <Field label="Gateway" htmlFor="gateway" width="lg">
        <Select instanceId="gateway" options={GATEWAY_OPTIONS} value="authorizenet" onChange={() => {}} isDisabled />
      </Field>
      <div className={s.row}>
        <Field label="API Login" htmlFor="gatewayLogin" width="lg">
          <Input
            id="gatewayLogin"
            maxLength={100}
            autoComplete="off"
            value={values.gatewayLogin}
            onChange={(e) => set('gatewayLogin', e.target.value)}
          />
        </Field>
        <Field label="API Transaction Key" htmlFor="gatewayTransKey" width="lg">
          <Input
            id="gatewayTransKey"
            maxLength={100}
            autoComplete="off"
            value={values.gatewayTransKey}
            onChange={(e) => set('gatewayTransKey', e.target.value)}
          />
        </Field>
      </div>

      <h2 className={s.heading}>Paypal Express Checkout</h2>
      <div className={s.row}>
        <Field label="Paypal API Username" htmlFor="paypalUserId" width="lg">
          <Input
            id="paypalUserId"
            maxLength={50}
            autoComplete="off"
            value={values.paypalUserId}
            onChange={(e) => set('paypalUserId', e.target.value)}
          />
        </Field>
        <Field label="Paypal API Password" htmlFor="paypalPassword" width="lg">
          <Input
            id="paypalPassword"
            maxLength={50}
            autoComplete="off"
            value={values.paypalPassword}
            onChange={(e) => set('paypalPassword', e.target.value)}
          />
        </Field>
      </div>
      <div className={s.row}>
        <Field label="Paypal API Signature" htmlFor="paypalTransactionKey" width="lg">
          <Input
            id="paypalTransactionKey"
            maxLength={100}
            autoComplete="off"
            value={values.paypalTransactionKey}
            onChange={(e) => set('paypalTransactionKey', e.target.value)}
          />
        </Field>
        <Field label="Paypal Email" htmlFor="paypalEmail" width="lg">
          <Input
            id="paypalEmail"
            maxLength={100}
            autoComplete="off"
            value={values.paypalEmail}
            onChange={(e) => set('paypalEmail', e.target.value)}
          />
        </Field>
      </div>

      <div className={s.actions}>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
