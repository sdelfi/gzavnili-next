import type { GreetingCopy } from './types';

function bucketFor(hour: number) {
  if (hour >= 23 || hour < 6) return 'night';
  if (hour < 11) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

// Legacy `authenticate/login.html` picks this from the visitor's IP-geolocated country (a
// server-side lookup against an `ipcountry` table, then +8h if not US/CA — a proxy for "is
// this visitor in Georgia"). There's no IP-geolocation table in this stack. An earlier
// version of this component read the *visitor's* browser clock client-side instead (more
// accurate per-visitor than any server-side guess), but that violates AGENTS.md's "public
// pages are server-rendered" rule — the greeting would render blank/missing in the initial
// HTML and pop in after hydration, which matters for SEO and is a visible flash of missing
// content. Server-rendered using the *server's* own clock instead: less accurate for a
// visitor far from the server's timezone, but real, present content in the first response —
// the tradeoff AGENTS.md's rule explicitly calls for.
export function Greeting({ copy }: { copy: GreetingCopy }) {
  const { heading, text } = copy[bucketFor(new Date().getHours())];
  return (
    <>
      <h3>{heading}</h3>
      <p>{text}</p>
    </>
  );
}
