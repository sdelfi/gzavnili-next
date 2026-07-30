'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import cn from 'classnames';
import { routes } from '@/lib/routes';
import s from './Sidebar.module.css';

const COLLAPSED_STORAGE_KEY = 'bema.sidebarCollapsed';

type NavItem = {
  label: string;
  href: string;
  /** Matched against the current path (+ search params, for query-param-differentiated
      routes like the users list) to highlight the active item. */
  isActive: (pathname: string, search: URLSearchParams) => boolean;
};

// Grows with every new bema module (parcels, products, orders, statements, content,
// reports, messages, config — see docs/migrations/06-phased-rollout-plan.md Phase 4) —
// this is the one place to add a new section, not something duplicated per page. See
// docs/decisions/0011-bema-admin.md.
const NAV_ITEMS: NavItem[] = [
  {
    label: 'BEMA Users',
    href: routes.bema.users({ accountType: 'BemaUser' }),
    isActive: (pathname, search) => pathname === '/bema/users' && search.get('accountType') !== 'Customer',
  },
  {
    label: 'Customers',
    href: routes.bema.users({ accountType: 'Customer' }),
    isActive: (pathname, search) => pathname === '/bema/users' && search.get('accountType') === 'Customer',
  },
];

function monogram(label: string) {
  return label
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function Sidebar({ user, onLogout }: { user: { username: string }; onLogout: () => void }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);

  // Read the persisted preference after mount (not during render) to avoid a
  // server/client markup mismatch — bema is CSR-only anyway, so a one-frame flash of the
  // default (expanded) state is an acceptable trade-off here. The `Promise.resolve().then`
  // (rather than calling `setCollapsed` directly) keeps this out of react-hooks'
  // "no setState synchronously in an effect" rule, same pattern used in AuthProvider/
  // UserListPage for the same reason.
  useEffect(() => {
    Promise.resolve().then(() => {
      setCollapsed(localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true');
    });
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <nav className={cn(s.sidebar, { [s.collapsed]: collapsed })}>
      <div className={s.header}>
        {!collapsed && <span className={s.brand}>bema</span>}
        <button type="button" className={s.toggle} onClick={toggle} title={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? '»' : '«'}
        </button>
      </div>

      <ul className={s.navList}>
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn(s.navLink, { [s.active]: item.isActive(pathname, search) })}
              title={collapsed ? item.label : undefined}
            >
              {collapsed ? <span className={s.monogram}>{monogram(item.label)}</span> : item.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className={s.footer}>
        {!collapsed && <span className={s.username}>{user.username}</span>}
        <button type="button" className={s.logoutButton} onClick={onLogout} title="Logout">
          {collapsed ? '⏻' : 'Logout'}
        </button>
      </div>
    </nav>
  );
}
