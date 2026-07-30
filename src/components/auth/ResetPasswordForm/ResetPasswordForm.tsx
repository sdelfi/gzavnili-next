'use client';

import { useActionState } from 'react';
import { resetPasswordAction, type ActionState } from '@/app/[locale]/authenticate/actions';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import s from './ResetPasswordForm.module.css';

export function ResetPasswordForm({ locale, token }: { locale: string; token: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(resetPasswordAction, undefined);

  return (
    <form action={formAction} className={s.form}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      {state?.error && <Alert variant="error">{state.error}</Alert>}

      <div className="input-group">
        <label htmlFor="reset_password">New Password</label>
        <Input type="password" id="reset_password" name="reset_password" required />
      </div>
      <div className="input-group">
        <label htmlFor="reset_passwordverify">Confirm Password</label>
        <Input type="password" id="reset_passwordverify" name="reset_passwordverify" required />
      </div>

      <button type="submit" className="btn btn-blue" disabled={pending}>
        {pending ? 'Saving…' : 'Set new password'}
      </button>
    </form>
  );
}
