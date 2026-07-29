import { HeaderClient } from './HeaderClient';
import { isOfficeOpen } from '@/lib/officeHours';
import { getPreferredOfficeId } from '@/lib/preferences';

// Async Server Component: reads the office cookie and computes the real open/closed status
// at request time, so HeaderClient never has to guess and then correct itself. This makes
// every route using this layout dynamically rendered (no static shell) rather than
// statically generated — see docs/decisions/0005-cache-components.md for why: an earlier
// version tried to keep static generation via a Suspense-streamed fallback, but that
// guarantees a two-phase render (wrong default shown first, then swapped), which is worse
// for above-the-fold identity like "which office is selected" than paying for a per-request
// render of a cookie read + a timezone calculation (no I/O — still fast off our own VDS).
export async function Header() {
  const officeId = await getPreferredOfficeId();
  return <HeaderClient initialOfficeId={officeId} initialOfficeOpenNow={isOfficeOpen(officeId)} />;
}
