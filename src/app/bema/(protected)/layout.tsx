'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useBemaAuth } from '@/components/admin/AuthProvider';
import { routes } from '@/lib/routes';
import s from './protected.module.css';

// Client-side auth guard for every route under this group — CSR-only, per
// docs/migrations/03-target-architecture.md §3 ("no need for Next.js middleware-based SSR
// auth gating"). The actual authorization is always enforced server-side in each API route
// handler (see src/lib/auth/session.ts's `requireBemaSession`) regardless of this redirect
// — this only avoids flashing protected UI at an unauthenticated visitor.
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useBemaAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(routes.bema.login());
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className={s.loading}>Loading…</div>;
  }

  return (
    <div className={s.shell}>
      <nav className={s.nav}>
        <div className={s.brand}>bema</div>
        <ul className={s.navList}>
          <li>
            <Link href={routes.bema.users({ accountType: 'BemaUser' })}>BEMA Users</Link>
          </li>
          <li>
            <Link href={routes.bema.users({ accountType: 'Customer' })}>Customers</Link>
          </li>
        </ul>
        <div className={s.navUser}>
          <span>{user.username}</span>
          <button
            type="button"
            onClick={async () => {
              await logout();
              router.push(routes.bema.login());
            }}
          >
            Logout
          </button>
        </div>
      </nav>
      <main className={s.content}>{children}</main>
    </div>
  );
}
