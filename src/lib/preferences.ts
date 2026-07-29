import { cookies } from 'next/headers';
import { DEFAULT_OFFICE_ID, OFFICE_COOKIE, isOfficeId } from './offices';
import type { OfficeId } from './officeHours';

// Reads the visitor's office selection from a cookie (not localStorage) specifically so it
// can be read here, server-side, before first paint — see docs/decisions/0005-cache-components.md
// for why that avoids the open/closed-badge flash the client-only version had.
export async function getPreferredOfficeId(): Promise<OfficeId> {
  const store = await cookies();
  const value = store.get(OFFICE_COOKIE)?.value;
  return isOfficeId(value) ? value : DEFAULT_OFFICE_ID;
}
