'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AdminRole } from '@/generated/prisma/client';
import { fetchMe, logout as logoutRequest, refreshSession } from '@/lib/api/bema/auth';

// bema is CSR-only (docs/migrations/03-target-architecture.md §3) — session state is
// resolved client-side via /api/bema/auth/me, not read server-side from a cookie during
// render. `user` is a plain JSON-safe projection of the `User` row (see
// src/lib/auth/publicUser.ts), not the full Prisma model.
export type BemaUser = {
  id: string;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  adminRole: AdminRole | null;
  /** Only `/me` includes this — it decides which payment methods the parcels screen offers. */
  billingAddress?: { country: string | null } | null;
  /** BEMA Agent flat per-kg rate (see `resolveAgentFlatRate()` in `lib/parcels/batchPricing`)
   *  — a `Decimal` on the server, so this arrives JSON-serialised as a numeric string. */
  agentPrice?: string | number | null;
};

type AuthState = {
  user: BemaUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<BemaUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Used for post-login/manual refreshes (event handlers, not effects) — setState here
  // runs outside any effect body, so it's not subject to the "no setState synchronously in
  // an effect" rule the mount effect below has to work around.
  const refresh = useCallback(async () => {
    setUser(await fetchMe());
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMe().then((nextUser) => {
      if (cancelled) return;
      setUser(nextUser);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The access-token cookie is short-lived (15min, ACCESS_TOKEN_TTL_SECONDS) by design —
  // `/api/bema/auth/refresh` rotates it (sliding session), but until now nothing ever
  // called it. Every API call — not just the idle-lock modal's re-auth — silently started
  // 401ing after 15 minutes in any tab left open that long. Refreshing on a timer well
  // inside that window (10min) keeps the session alive for as long as the tab is open,
  // matching the sliding-session design this endpoint already existed for.
  const isLoggedIn = user !== null;
  useEffect(() => {
    if (!isLoggedIn) return;
    const interval = setInterval(() => refreshSession().catch(() => {}), 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  return <AuthContext.Provider value={{ user, loading, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useBemaAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useBemaAuth must be used within AuthProvider');
  return ctx;
}
