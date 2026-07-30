'use client';

import { useActionState, useState } from 'react';
import { registerAction, type ActionState } from '@/app/[locale]/authenticate/actions';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert, ErrorList } from '@/components/ui/Alert';
import { COUNTRIES } from '@/lib/countries';
import s from './RegisterForm.module.css';

// Legacy `register.html`'s field set (firstname/lastname/email/phone/country/city/
// address/state/postalcode/privatenumber/password) — username is never asked for, it's
// auto-generated (`GZ`+incrementing number, see customerRegister.ts). No email-verification
// step: new accounts are active/confirmed immediately, a documented simplification (see
// docs/decisions/0012-customer-auth.md) since no confirmation-email flow is built yet.
export function RegisterForm({ locale }: { locale: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(registerAction, undefined);
  const fieldErrors = state?.fieldErrors ?? {};
  // `Select` (react-select) needs controlled value/onChange even inside a Server Action
  // form — passing `name` to it renders the hidden input FormData actually submits.
  const [country, setCountry] = useState('');

  return (
    <form action={formAction} className={s.form}>
      <input type="hidden" name="locale" value={locale} />
      {state?.error && <Alert variant="error">{state.error}</Alert>}

      <div className={s.grid}>
        <div className="input-group">
          <label htmlFor="register_firstname">First Name</label>
          <Input id="register_firstname" name="register_firstname" required />
          <ErrorList errors={fieldErrors.register_firstname ?? []} />
        </div>
        <div className="input-group">
          <label htmlFor="register_lastname">Last Name</label>
          <Input id="register_lastname" name="register_lastname" required />
          <ErrorList errors={fieldErrors.register_lastname ?? []} />
        </div>

        <div className="input-group">
          <label htmlFor="register_emailaddress">Email</label>
          <Input type="email" id="register_emailaddress" name="register_emailaddress" required />
          <ErrorList errors={fieldErrors.register_emailaddress ?? []} />
        </div>
        <div className="input-group">
          <label htmlFor="phone">Cell Phone</label>
          <Input id="phone" name="phone" required />
          <ErrorList errors={fieldErrors.phone ?? []} />
        </div>

        <div className="input-group">
          <label htmlFor="country">Country</label>
          <Select
            instanceId="register-country"
            name="country"
            options={COUNTRIES}
            value={country}
            onChange={setCountry}
            placeholder="Choose Country"
          />
          <ErrorList errors={fieldErrors.country ?? []} />
        </div>
        <div className="input-group">
          <label htmlFor="city">City</label>
          <Input id="city" name="city" required />
          <ErrorList errors={fieldErrors.city ?? []} />
        </div>

        <div className="input-group">
          <label htmlFor="state">State/Province</label>
          <Input id="state" name="state" />
        </div>
        <div className="input-group">
          <label htmlFor="postalcode">Zip Code</label>
          <Input id="postalcode" name="postalcode" />
        </div>

        <div className="input-group">
          <label htmlFor="address">Address</label>
          <Input id="address" name="address" required />
          <ErrorList errors={fieldErrors.address ?? []} />
        </div>
        <div className="input-group">
          <label htmlFor="register_privatenumber">Private Number</label>
          <Input id="register_privatenumber" name="register_privatenumber" maxLength={11} />
        </div>

        <div className="input-group">
          <label htmlFor="register_password">Password</label>
          <Input type="password" id="register_password" name="register_password" required />
          <ErrorList errors={fieldErrors.register_password ?? []} />
        </div>
        <div className="input-group">
          <label htmlFor="register_passwordverify">Confirm Password</label>
          <Input type="password" id="register_passwordverify" name="register_passwordverify" required />
          <ErrorList errors={fieldErrors.register_passwordverify ?? []} />
        </div>
      </div>

      <button type="submit" className="btn btn-blue" disabled={pending}>
        {pending ? 'Creating account…' : 'Register'}
      </button>
    </form>
  );
}
