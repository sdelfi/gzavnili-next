'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useBemaAuth } from '@/components/admin/AuthProvider';
import { routes } from '@/lib/routes';
import { rememberBemaReturnPath } from '@/lib/auth/bemaReturnPath';

// Auth guard for the small popup windows legacy opened via `window.open(...)` (Scan/Print/
// View) — same client-side redirect-if-unauthenticated check as `(protected)/layout.tsx`,
// but without its Sidebar/TopBar chrome, matching legacy's own `request.pageLayout =
// "BemaStatic"` for these screens. Authorization is still always enforced server-side by
// each API route's `requireBemaSession` regardless of this redirect.
export default function PopupLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useBemaAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      rememberBemaReturnPath(`${window.location.pathname}${window.location.search}${window.location.hash}`);
      router.replace(routes.bema.login());
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <div>Loading…</div>;
  }

  return <>{children}</>;
}
