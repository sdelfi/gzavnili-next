'use client';

import { useActionState } from 'react';
import { loginAction, type ActionState } from '@/app/[locale]/authenticate/actions';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { routes } from '@/lib/routes';
import s from './LoginForm.module.css';

// Customer-facing login form — same `loginAction` Server Action is also bound to the quick
// login modal in HeaderClient, so both submit through the exact same code path/validation.
export function LoginForm({ locale, ret }: { locale: string; ret?: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(loginAction, undefined);

  return (
    <form action={formAction} className={s.form}>
      <input type="hidden" name="locale" value={locale} />
      {ret && <input type="hidden" name="ret" value={ret} />}
      {state?.error && <Alert variant="error">{state.error}</Alert>}

      <div className="input-group">
        <label htmlFor="login_username">Email or User ID</label>
        <Input type="text" id="login_username" name="login_username" autoComplete="username" required />
      </div>
      <div className="input-group">
        <label htmlFor="login_password">Password</label>
        <Input type="password" id="login_password" name="login_password" autoComplete="current-password" required />
      </div>
      <label className={s.checkbox}>
        <input type="checkbox" name="remember_me" value="true" /> Remember me
      </label>

      <button type="submit" className="btn btn-blue" disabled={pending}>
        {pending ? 'Signing in…' : 'Log in'}
      </button>

      <p className={s.links}>
        <a href={routes.forgotPassword()}>Can&apos;t access your account?</a>
      </p>
      <p className={s.links}>
        New to Gzavnili? <a href={routes.register()}>Create an account</a>
      </p>
    </form>
  );
}
