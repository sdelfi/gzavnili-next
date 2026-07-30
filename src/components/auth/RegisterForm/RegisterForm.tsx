'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { registerAction, type ActionState } from '@/app/[locale]/authenticate/actions';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert, ErrorList } from '@/components/ui/Alert';
import { COUNTRIES } from '@/lib/countries';
import { routes } from '@/lib/routes';

// Legacy `register.html`'s field set and layout 1:1 — the `.row`/`.col`/`.col-6` grid (a
// custom 12-unit system in style.css, distinct from the Bootstrap-style grid the login page
// uses) and `.input-group`/`.accreg-btn-block`/`.agree` classes are all already global
// (style.css), so no new CSS was needed here, unlike the login page's pixel-parity pass.
// Username is never asked for, it's auto-generated (`GZ`+incrementing number, see
// customerRegister.ts). No email-verification step: new accounts are active/confirmed
// immediately, a documented simplification (see docs/decisions/0012-customer-auth.md) since
// no confirmation-email flow is built yet.
export function RegisterForm({ locale }: { locale: string }) {
  const t = useTranslations('Register');
  const [state, formAction, pending] = useActionState<ActionState, FormData>(registerAction, undefined);
  const fieldErrors = state?.fieldErrors ?? {};
  // `Select` (react-select) needs controlled value/onChange even inside a Server Action
  // form — passing `name` to it renders the hidden input FormData actually submits.
  const [country, setCountry] = useState('');

  return (
    <form action={formAction} id="registerForm">
      <input type="hidden" name="locale" value={locale} />
      {state?.error && <Alert variant="error">{state.error}</Alert>}

      <div className="row">
        <div className="col col-6 col-sm-6 col-xs-12">
          <div className="input-group">
            <label htmlFor="register_firstname">{t('firstName')}:</label>
            <Input id="register_firstname" name="register_firstname" required />
            <ErrorList errors={fieldErrors.register_firstname ?? []} />
          </div>
        </div>
        <div className="col col-6 col-sm-6 col-xs-12">
          <div className="input-group">
            <label htmlFor="register_lastname">{t('lastName')}:</label>
            <Input id="register_lastname" name="register_lastname" required />
            <ErrorList errors={fieldErrors.register_lastname ?? []} />
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col col-6 col-sm-6 col-xs-12">
          <div className="input-group">
            <label htmlFor="register_emailaddress">{t('email')}:</label>
            <Input type="email" id="register_emailaddress" name="register_emailaddress" required />
            <ErrorList errors={fieldErrors.register_emailaddress ?? []} />
          </div>
        </div>
        <div className="col col-6 col-sm-6 col-xs-12">
          <div className="input-group">
            <label htmlFor="phone">{t('cellPhone')}:</label>
            <Input id="phone" name="phone" maxLength={50} required />
            <ErrorList errors={fieldErrors.phone ?? []} />
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col col-6 col-sm-6 col-xs-12">
          <div className="input-group">
            <label htmlFor="country">{t('country')}:</label>
            <Select
              instanceId="register-country"
              name="country"
              options={COUNTRIES}
              value={country}
              onChange={setCountry}
              placeholder={t('chooseCountry')}
            />
            <ErrorList errors={fieldErrors.country ?? []} />
          </div>
        </div>
        <div className="col col-6 col-sm-6 col-xs-12">
          <div className="input-group">
            <label htmlFor="city">{t('city')}:</label>
            <Input id="city" name="city" maxLength={50} required />
            <ErrorList errors={fieldErrors.city ?? []} />
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col col-6 col-sm-6 col-xs-12">
          <div className="row row-narrow">
            <div className="col col-8">
              <div className="input-group">
                <label htmlFor="state">{t('stateProvince')}:</label>
                <Input id="state" name="state" maxLength={50} />
              </div>
            </div>
            <div className="col col-4">
              <div className="input-group">
                <label htmlFor="postalcode">{t('zipCode')}:</label>
                <Input id="postalcode" name="postalcode" maxLength={50} />
              </div>
            </div>
          </div>
        </div>
        <div className="col col-6 col-sm-6 col-xs-12">
          <div className="input-group">
            <label htmlFor="address">{t('address')}:</label>
            <Input id="address" name="address" maxLength={50} required />
            <ErrorList errors={fieldErrors.address ?? []} />
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col col-6 col-sm-6 col-xs-12">
          <div className="input-group">
            <label htmlFor="register_password">{t('password')}:</label>
            <Input type="password" id="register_password" name="register_password" required />
            <ErrorList errors={fieldErrors.register_password ?? []} />
          </div>
        </div>
        <div className="col col-6 col-sm-6 col-xs-12">
          <div className="input-group">
            <label htmlFor="register_passwordverify">{t('confirmPassword')}:</label>
            <Input type="password" id="register_passwordverify" name="register_passwordverify" required />
            <ErrorList errors={fieldErrors.register_passwordverify ?? []} />
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col col-6 col-sm-6 col-xs-12">
          <div className="input-group">
            <label htmlFor="register_privatenumber">{t('privateNumber')}:</label>
            <Input id="register_privatenumber" name="register_privatenumber" maxLength={11} />
          </div>
        </div>
        <div className="col col-6 col-sm-6 col-xs-12">
          <div className="input-group">
            <label>{t('chooseNotificationLanguage')}:</label>
            <div className="input-group message-language">
              <label>
                <input name="language" type="radio" value="en" defaultChecked={locale !== 'ge'} /> {t('languageEnglish')}
              </label>
              <label>
                <input name="language" type="radio" value="ge" defaultChecked={locale === 'ge'} /> {t('languageGeorgian')}
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="accreg-btn-block">
        <div className="agree">
          <label>
            <input type="checkbox" name="register_terms" value="1" required />{' '}
            <span>
              {t('agreeTermsPrefix')} <a href={routes.page('terms-and-conditions')}>{t('termsAndConditions')}</a>{' '}
              {t('agreeTermsMiddle')} <a href={routes.page('privacy-policy')}>{t('privacyPolicy')}</a>
            </span>
          </label>
          <ErrorList errors={fieldErrors.register_terms ?? []} />
        </div>
        <div className="btn-block">
          <input type="submit" value={pending ? '…' : t('submit')} className="btn btn-blue" disabled={pending} />
        </div>
      </div>
    </form>
  );
}
