'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useBemaAuth } from '@/components/admin/AuthProvider';
import { routes } from '@/lib/routes';
import s from './IdleModal.module.css';

// Matches the legacy `bema.js` idle-lock: 5 minutes of no mousemove/keypress anywhere on
// the page locks the screen behind a non-dismissible modal (Bootstrap `backdrop: 'static',
// keyboard: false` there — no overlay click or Escape close here either) until the current
// password (or another BemaUser's short password, to hand off a shared terminal) is
// re-entered. State is persisted to localStorage (legacy used cookies) so a page reload
// while idle-locked re-shows the modal instead of silently unlocking.
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const CHECK_INTERVAL_MS = 60000 / 3; // 20s, matching the legacy poll interval
const LOCKED_KEY = 'bema.idleLocked';
const LAST_ACTIVITY_KEY = 'bema.lastActivityAt';

export function IdleModal() {
  const { user, logout } = useBemaAuth();
  const router = useRouter();
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const markActivity = () => {
      window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    };
    window.addEventListener('mousemove', markActivity);
    window.addEventListener('keypress', markActivity);

    const interval = window.setInterval(() => {
      const last = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY) ?? Date.now());
      if (Date.now() - last > IDLE_TIMEOUT_MS) {
        window.localStorage.setItem(LOCKED_KEY, '1');
        setLocked(true);
      }
    }, CHECK_INTERVAL_MS);

    Promise.resolve().then(() => {
      markActivity();
      if (window.localStorage.getItem(LOCKED_KEY) === '1') setLocked(true);
    });

    return () => {
      window.removeEventListener('mousemove', markActivity);
      window.removeEventListener('keypress', markActivity);
      window.clearInterval(interval);
    };
  }, []);

  if (!locked || !user) return null;

  async function submitCheckPassword() {
    const res = await fetch('/api/bema/auth/check-password', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    return { res, body: await res.json().catch(() => ({ result: 0 })) };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      let { res, body } = await submitCheckPassword();

      // The access-token cookie (15min TTL) can easily have expired while this modal sat
      // idle-locked, well before it appeared: it shows up after 5 minutes of inactivity, but
      // a user might not come back to type their password for another 10+ minutes after
      // that. A 401 here isn't "wrong password" (the real message the old code showed,
      // confusingly) — it's "your session needs a refresh." Try that once, silently, and
      // resubmit before giving up.
      if (res.status === 401) {
        const refreshed = await fetch('/api/bema/auth/refresh', { method: 'POST', credentials: 'same-origin' });
        if (!refreshed.ok) {
          // Refresh token's gone too (7-day TTL lapsed, or revoked) — nothing left to
          // salvage client-side, send them through the real login flow.
          await logout();
          router.push(routes.bema.login());
          return;
        }
        ({ res, body } = await submitCheckPassword());
      }

      if (body.result === 1 || body.result === 2) {
        window.localStorage.setItem(LOCKED_KEY, '0');
        window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
        setPassword('');
        setLocked(false);
        if (body.result === 2) {
          // Session was switched to a different BemaUser (short-password handoff) —
          // reload so every client-side auth-derived view picks up the new identity.
          window.location.reload();
        }
      } else {
        setError('Wrong password');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={s.overlay} role="dialog" aria-modal="true">
      <div className={s.dialog}>
        <h4 className={s.title}>
          Hello, {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.username} ({user.username})
        </h4>
        <p>Please confirm your password:</p>
        <form className={s.form} onSubmit={handleSubmit}>
          <Input
            type="password"
            autoComplete="off"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" disabled={submitting}>
            Confirm
          </Button>
        </form>
        {error && <p className={s.error}>{error}</p>}
        <p className={s.switchAccount}>
          If you are not {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.username} (
          {user.username}) —{' '}
          <button
            type="button"
            className={s.logoutLink}
            onClick={async () => {
              await logout();
              router.push(routes.bema.login());
            }}
          >
            Click here
          </button>{' '}
          to login with your account
        </p>
      </div>
    </div>
  );
}
