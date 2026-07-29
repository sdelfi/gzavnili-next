import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Locale-aware Link/redirect/usePathname/useRouter — use these instead of next/link and
// next/navigation anywhere the href/path needs the current locale's prefix applied
// automatically (e.g. Georgian gets "/ge/..." prepended, English doesn't).
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
