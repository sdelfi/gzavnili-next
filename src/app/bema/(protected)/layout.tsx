'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useBemaAuth } from '@/components/admin/AuthProvider';
import { Sidebar } from '@/components/admin/Sidebar';
import { TopBar } from '@/components/admin/TopBar';
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
      {/* useSearchParams (used to highlight the active nav item) needs a Suspense
          boundary — see the other bema pages that read search params for the same reason. */}
      <Suspense fallback={null}>
        <Sidebar
          user={user}
          onLogout={async () => {
            await logout();
            router.push(routes.bema.login());
          }}
        />
      </Suspense>
      <div className={s.main}>
        <TopBar />
        <main className={s.content}>{children}</main>
      </div>
    </div>
  );
}
