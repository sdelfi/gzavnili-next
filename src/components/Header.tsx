import { Suspense } from "react";
import { HeaderClient } from "./HeaderClient";
import { HeaderPersonalized } from "./HeaderPersonalized";
import { DEFAULT_OFFICE_ID } from "@/lib/offices";

// Server Component wrapper: HeaderPersonalized reads the office cookie (a runtime API), so
// it has to sit behind a Suspense boundary to keep the rest of the (public) route tree
// statically generated — see docs/decisions/0005-cache-components.md. The fallback is what
// ships in the prerendered static shell; it can't compute `new Date()` at build time (Next
// rejects that — no request-data source yet), so it renders with the open/closed badge
// hidden. HeaderPersonalized resolves almost immediately at request time (cookie read + a
// timezone calculation, no I/O), so in practice visitors see the correct badge on first
// paint, not a placeholder-then-swap.
export function Header() {
  return (
    <Suspense fallback={<HeaderClient initialOfficeId={DEFAULT_OFFICE_ID} initialOfficeOpenNow={null} />}>
      <HeaderPersonalized />
    </Suspense>
  );
}
