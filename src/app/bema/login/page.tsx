'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { routes } from '@/lib/routes';
import { useBemaAuth } from '@/components/admin/AuthProvider';
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
      const res = await fetch('/api/bema/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? 'Login failed.');
        return;
      }
      await refresh();
      router.push(routes.bema.users());
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
