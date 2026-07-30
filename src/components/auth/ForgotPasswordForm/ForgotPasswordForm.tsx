'use client';

import { useActionState } from 'react';
import { forgotPasswordAction, type ActionState } from '@/app/[locale]/authenticate/actions';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import s from './ForgotPasswordForm.module.css';

// Legacy `forgotlogin.html`'s "password" case, email-only (the phone/SMS case is out of
// scope for this pass — see PROGRESS.md). Always shows the same success message regardless
// of whether the email matched an account (see requestPasswordReset's comment).
export function ForgotPasswordForm({ locale }: { locale: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(forgotPasswordAction, undefined);

  return (
    <form action={formAction} className={s.form}>
      <input type="hidden" name="locale" value={locale} />
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.success}</Alert>}

      <div className="input-group">
        <label htmlFor="forgot_username">Email Address</label>
        <Input type="email" id="forgot_username" name="forgot_username" placeholder="mail@mail.com" required />
      </div>

      <button type="submit" className="btn btn-blue" disabled={pending}>
        {pending ? 'Sending…' : 'Reset password'}
      </button>
    </form>
  );
}
