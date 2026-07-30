import { readAccessToken } from './customerCookies';
import { verifyAccessToken, type CustomerTokenPayload } from './customerJwt';

// Server Component/Server Action-safe session read (uses `next/headers`'s `cookies()`,
// unlike the bema realm's `NextRequest`-based `getBemaSession` — the public site's forms
// use Server Actions, not `/api/bema`-style Route Handlers taking a `NextRequest`).
export async function getCustomerSession(): Promise<CustomerTokenPayload | null> {
  const token = await readAccessToken();
  if (!token) return null;
  return verifyAccessToken(token);
}
