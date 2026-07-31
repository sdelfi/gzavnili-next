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
  href?: string;
  /** Matched against the current path (+ search params, for query-param-differentiated
      routes like the users list) to highlight the active item. Omitted for not-yet-built
      items (no `href`). */
  isActive?: (pathname: string, search: URLSearchParams) => boolean;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

// Full menu structure recorded from the live legacy bema panel (lytBema.cfm's nav), not
// invented — see docs/decisions/0011-bema-admin.md. Only "Customers" and "BEMA Users" are
// wired up so far (this pass's actual scope); everything else is a recorded placeholder
// (no `href`, rendered disabled) so the real information architecture is visible and the
// group it belongs in doesn't have to be rediscovered later. Coupons stays in the list
// structurally (it's in the legacy nav) but is explicitly out of migration scope per
// docs/migrations/00-overview.md's "Non-goals" — it will never get a working link here.
const NAV_GROUPS: NavGroup[] = [
  {
    title: 'CUSTOMERS',
    items: [
      {
        label: 'Customers',
        href: routes.bema.users({ accountType: 'Customer' }),
        isActive: (pathname, search) => pathname === '/bema/users' && search.get('accountType') === 'Customer',
      },
      {
        label: 'Receivers',
        href: routes.bema.receivers(),
        isActive: (pathname) => pathname.startsWith('/bema/receivers'),
      },
      {
        label: 'Parcels',
        href: routes.bema.parcels(),
        isActive: (pathname, search) => pathname === '/bema/parcels' && search.get('deliveryRequest') !== '1',
      },
      { label: 'Parcels Reports' },
      { label: 'Parcels Reports 2' },
      {
        // Legacy's `parcels.cfm?delreq=1` — its own nav entry there too, but the same screen
        // with an extra filter and an extra column, not a separate page.
        label: 'Delivery Request',
        href: routes.bema.deliveryRequests(),
        isActive: (pathname, search) => pathname === '/bema/parcels' && search.get('deliveryRequest') === '1',
      },
      {
        label: 'Add Parcel',
        href: routes.bema.parcelAdd(),
        isActive: (pathname) => pathname === '/bema/parcels/add',
      },
      { label: 'Add Online Parcel' },
      { label: 'Check on hold' },
      { label: 'Change Parcel status' },
      { label: 'Money collect' },
      { label: 'Pricing Rules' },
    ],
  },
  {
    title: 'MESSAGES',
    items: [
      { label: 'Send SMS by Trip Date' },
      { label: 'Send SMS Custom' },
      { label: 'Send Bulk SMS' },
      { label: 'Send SMS' },
      { label: 'SMS list' },
      { label: 'Send message' },
      { label: 'Messages' },
    ],
  },
  {
    title: 'COUPONS',
    items: [{ label: 'Stores' }],
  },
  {
    title: 'CONTENT',
    items: [
      {
        label: 'Site Pages',
        href: routes.bema.pages(),
        isActive: (pathname) => pathname.startsWith('/bema/pages'),
      },
      { label: 'Files' },
    ],
  },
  {
    title: 'CONFIGURATION',
    items: [
      { label: 'Georgian Offices' },
      { label: 'System Emails' },
      { label: 'Payment Setup' },
      {
        label: 'Site Settings',
        href: routes.bema.settings(),
        isActive: (pathname) => pathname.startsWith('/bema/settings'),
      },
    ],
  },
  {
    title: 'BEMA',
    items: [
      {
        label: 'BEMA Users',
        href: routes.bema.users({ accountType: 'BemaUser' }),
        isActive: (pathname, search) => pathname === '/bema/users' && search.get('accountType') !== 'Customer',
      },
    ],
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
        {!collapsed && <span className={s.brand}>GZAVNILI</span>}
        <button type="button" className={s.toggle} onClick={toggle} title={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? '»' : '«'}
        </button>
      </div>

      <div className={s.scrollArea}>
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className={s.group}>
            {!collapsed && <div className={s.groupTitle}>{group.title}</div>}
            <ul className={s.navList}>
              {group.items.map((item) =>
                item.href ? (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className={cn(s.navLink, { [s.active]: item.isActive?.(pathname, search) })}
                      title={collapsed ? item.label : undefined}
                    >
                      {collapsed ? <span className={s.monogram}>{monogram(item.label)}</span> : item.label}
                    </Link>
                  </li>
                ) : collapsed ? null : (
                  // Recorded from the legacy nav but not built yet — see the NAV_GROUPS
                  // comment above. Rendered inert (no href, no click handler) rather than
                  // silently omitted.
                  <li key={item.label}>
                    <span className={cn(s.navLink, s.disabled)} title="Not implemented yet">
                      {item.label}
                    </span>
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </div>

      <div className={s.footer}>
        {!collapsed && <span className={s.username}>{user.username}</span>}
        <button type="button" className={s.logoutButton} onClick={onLogout} title="Logout">
          {collapsed ? '⏻' : 'Logout'}
        </button>
      </div>
    </nav>
  );
}
