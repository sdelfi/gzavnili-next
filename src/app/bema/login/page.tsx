'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/admin/Input';
import { Button } from '@/components/ui/admin/Button';
import { Alert } from '@/components/ui/admin/Alert';
import { routes } from '@/lib/routes';
import { useBemaAuth } from '@/components/admin/AuthProvider';
import { login } from '@/lib/api/bema/auth';
import { ApiError } from '@/lib/api/http';
import s from './login.module.css';

export default function BemaLoginPage() {
  const router = useRouter();
  const { refresh } = useBemaAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(username, password);
      await refresh();
      router.push(routes.bema.users());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={s.wrap}>
      <form className={s.form} onSubmit={handleSubmit}>
        <h1 className={s.heading}>bema</h1>
        {error && <Alert variant="error">{error}</Alert>}
        <label className={s.field}>
          Username or email
          <Input value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
        </label>
        <label className={s.field}>
          Password
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
