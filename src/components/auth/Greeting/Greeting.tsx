'use client';

import { useEffect, useState } from 'react';
import type { GreetingCopy, GreetingKey } from './types';

function bucketFor(hour: number): GreetingKey {
  if (hour >= 23 || hour < 6) return 'night';
  if (hour < 11) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

// Legacy `authenticate/login.html` picks this from the visitor's IP-geolocated country (a
// server-side lookup against an `ipcountry` table, then +8h if not US/CA — a proxy for "is
// this visitor in Georgia"). There's no IP-geolocation table in this stack, and guessing from
// the site's locale switcher (an earlier version of this component) was wrong for anyone
// browsing in a locale that doesn't match their actual timezone (e.g. testing the English
// site from Georgia in the evening). The one signal that's actually always correct for "what
// time is it for this visitor" is their own device clock — read client-side after mount, not
// guessed server-side, at the cost of the greeting appearing one tick after first paint
// (same trade-off as Sidebar's persisted-collapse-state read).
export function Greeting({ copy }: { copy: GreetingCopy }) {
  const [key, setKey] = useState<GreetingKey | null>(null);

  useEffect(() => {
    Promise.resolve().then(() => {
      setKey(bucketFor(new Date().getHours()));
    });
  }, []);

  if (!key) return null;
  const { heading, text } = copy[key];
  return (
    <>
      <h3>{heading}</h3>
      <p>{text}</p>
    </>
  );
}
