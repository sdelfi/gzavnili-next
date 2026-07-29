import { HeaderClient } from "./HeaderClient";
import { isOfficeOpen } from "@/lib/officeHours";
import { getPreferredOfficeId } from "@/lib/preferences";

// Async Server Component: reads the office cookie and computes the real open/closed status
// at request time. Rendered inside a <Suspense> boundary by Header.tsx so this is the only
// part of the page that's dynamic — everything else stays statically generated.
export async function HeaderPersonalized() {
  const officeId = await getPreferredOfficeId();
  return <HeaderClient initialOfficeId={officeId} initialOfficeOpenNow={isOfficeOpen(officeId)} />;
}
