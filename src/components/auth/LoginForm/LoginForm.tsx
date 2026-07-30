'use client';

import { useActionState } from 'react';
import cn from 'classnames';
import { useTranslations } from 'next-intl';
import { loginAction, type ActionState } from '@/app/[locale]/authenticate/actions';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { routes } from '@/lib/routes';
import authLayout from '@/components/auth/AuthLayout/AuthLayout.module.css';
import s from './LoginForm.module.css';

// Structure mirrors the legacy `authenticate/login.html` form 1:1 — `.formGroup`'s
// `a`-before-`label`-before-`input` order is load-bearing (AuthLayout.module.css floats the
// `a` right and lets the label's inline text wrap up beside it, not a flex/grid layout — see
// docs/decisions/0012-customer-auth.md). The legacy "Forgot your ID?" link above the
// username field is dropped entirely rather than ported empty: its text was already inside
// a ColdFusion comment in the legacy source (`<!---...Forgot your ID?--->`), so it rendered
// as a visible-nowhere, non-interactive empty `<a>` in production too. The button's arrow is
// a literal `&rarr;` character in legacy, not a sprite icon — ported the same way. Reuses
// `AuthLayout`'s CSS Module (`.formGroup`/`.btn*`/`.bottom`/`.or`) rather than duplicating it,
// since this form always renders inside that layout's `.inner`.
export function LoginForm({ locale, ret }: { locale: string; ret?: string }) {
  const t = useTranslations('Authenticate');
  const [state, formAction, pending] = useActionState<ActionState, FormData>(loginAction, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="locale" value={locale} />
      {ret && <input type="hidden" name="ret" value={ret} />}
      {state?.error && <Alert variant="error">{state.error}</Alert>}

      <div className={authLayout.formGroup}>
        <label htmlFor="login_username">{t('emailOrUserId')}</label>
        <Input
          type="text"
          className="form-control"
          id="login_username"
          name="login_username"
          autoComplete="username"
          required
        />
      </div>
      <div className={authLayout.formGroup}>
        <a href={routes.forgotPassword()}>{t('cantAccessAccount')}</a>
        <label htmlFor="login_password">{t('password')}</label>
        <Input
          type="password"
          className="form-control"
          id="login_password"
          name="login_password"
          autoComplete="current-password"
          required
        />
      </div>

      <label className={s.rememberMe}>
        <input type="checkbox" name="remember_me" value="true" /> {t('rememberMe')}
      </label>

      <div className={cn('row', authLayout.clearfix, authLayout.bottom, authLayout.verticalAlignMiddle)}>
        <div className="col-sm-5 col-xs-12">
          <button
            type="submit"
            className={cn(authLayout.btn, authLayout.btnPrimary, authLayout.btnBlock)}
            disabled={pending}
          >
            {t('logIn')} &rarr;
          </button>
        </div>
        <div className={cn('col-sm-1 col-xs-12', authLayout.or)}>{t('or')}</div>
        <div className="col-sm-6 col-xs-12">
          <a href={routes.register()}>{t('createAccount')}</a>
        </div>
      </div>
    </form>
  );
}
