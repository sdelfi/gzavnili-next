import type { OfficeId } from './officeHours';

export type Office = {
  id: OfficeId;
  name: string;
  phone: string;
  mail: string;
  mailHref: string;
  hours: string;
};

// Shared by the server-rendered (cookie-aware) and client-interactive halves of Header —
// see src/components/Header.tsx / HeaderPersonalized.tsx / HeaderClient.tsx.
export const OFFICES: Office[] = [
  {
    id: 'tbilisi',
    name: 'Tbilisi',
    phone: '+995 332 247 00 22',
    mail: 'tbilisi@gzavnili.com',
    mailHref: 'mailto:tbilisi@gzavnili.com',
    hours: 'Mon-Fri 11:00-19:00 · Sat-Sun 11:00-17:00',
  },
  {
    id: 'newyork',
    name: 'New York',
    phone: '+1 718 676 0022',
    mail: 'info@gzavnili.com',
    mailHref: 'mailto:info@gzavnili.com',
    hours: 'Mon-Fri 9:00-19:00 · Sat-Sun 10:00-17:00',
  },
  {
    id: 'delaware',
    name: 'Delaware',
    phone: '+1 718 676 0022',
    mail: 'wilmington@gzavnili.com',
    mailHref: 'mailto:wilmington@gzavnili.com',
    hours: 'Mon-Fri 9:00-19:00 · Sat-Sun Closed',
  },
];

export const DEFAULT_OFFICE_ID: OfficeId = 'tbilisi';
export const OFFICE_COOKIE = 'office';

export function isOfficeId(value: string | undefined): value is OfficeId {
  return !!value && OFFICES.some((office) => office.id === value);
}

// Non-httpOnly on purpose: this is a display preference, not a secret, and it needs to be
// readable both here (client write) and server-side in src/lib/preferences.ts (SSR read).
// A year is plenty for "remember my office". Kept as a standalone module-level function,
// not inlined in the click handler, so the `document.cookie` write isn't a component-closure
// mutation of an external reference (react-hooks/immutability).
export function setOfficeCookie(id: OfficeId) {
  document.cookie = `${OFFICE_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
}
