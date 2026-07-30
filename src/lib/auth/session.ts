import { NextRequest, NextResponse } from 'next/server';
import type { AdminRole } from '@/generated/prisma/client';
import { readAccessToken } from './cookies';
import { verifyAccessToken, type BemaTokenPayload } from './jwt';

export async function getBemaSession(request: NextRequest): Promise<BemaTokenPayload | null> {
  const token = readAccessToken(request);
  if (!token) return null;
  return verifyAccessToken(token);
}

// Mirrors the legacy `require.cfm` custom tag's `groups="A,B,C"` allow-list pattern (see
// extensions/custom_tags/require.cfm in the legacy app) — a flat "is this account's single
// role in the allow-list" check, not per-permission RBAC.
export function hasRole(session: BemaTokenPayload, allowedRoles: AdminRole[]): boolean {
  return allowedRoles.includes(session.role);
}

// Shared guard for API route handlers: returns the verified session, or a ready-to-return
// 401/403 NextResponse if the caller isn't authenticated/authorized. Every /api/bema/*
// route (other than the auth endpoints themselves) should start with this.
export async function requireBemaSession(
  request: NextRequest,
  allowedRoles: AdminRole[],
): Promise<{ session: BemaTokenPayload; response?: undefined } | { session?: undefined; response: NextResponse }> {
  const session = await getBemaSession(request);
  if (!session) {
    return { response: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) };
  }
  if (!hasRole(session, allowedRoles)) {
    return { response: NextResponse.json({ error: 'Not authorized.' }, { status: 403 }) };
  }
  return { session };
}
