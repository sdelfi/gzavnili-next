import type { BemaUser } from '@/components/admin/AuthProvider';
import { apiGet, apiPost } from '../http';

export async function fetchMe(): Promise<BemaUser | null> {
  try {
    return (await apiGet<{ user: BemaUser }>('/api/bema/auth/me')).user;
  } catch {
    return null;
  }
}

export function login(username: string, password: string) {
  return apiPost<{ user: BemaUser }>('/api/bema/auth/login', { username, password });
}

export async function logout(): Promise<void> {
  // Best-effort — the client clears its own session state regardless of whether the
  // server-side cookie-clear round-trip actually succeeds.
  await apiPost('/api/bema/auth/logout').catch(() => {});
}

export function refreshSession() {
  return apiPost<void>('/api/bema/auth/refresh');
}

export function checkPassword(password: string) {
  return apiPost<{ result: 0 | 1 | 2 }>('/api/bema/auth/check-password', { password });
}
