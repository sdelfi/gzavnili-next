'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Table, type Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { routes } from '@/lib/routes';
import type { BemaUser } from '@/components/admin/AuthProvider';
import s from './UserListPage.module.css';

type ListRow = BemaUser & { active: boolean; organization: string | null; createdAt: string };
type SortKey = 'lastName' | 'username' | 'email' | 'createdAt';

const ACTIVE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];
const PER_PAGE_OPTIONS = ['25', '50', '75', '100', '250', '500'].map((v) => ({ value: v, label: v }));

// Shared list screen for both BEMA admin accounts and customer accounts, parameterized by
// `accountType` — matches the legacy `users.cfm`'s `tid=1`/`tid=2` behavior (see
// docs/decisions/0011-bema-admin.md): one screen, one DAO/API, a query param decides which
// slice of `users` is shown, rather than two separately-built screens.
export function UserListPage({ accountType }: { accountType: 'BemaUser' | 'Customer' }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<ListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const page = Number(searchParams.get('page') ?? '1');
  const perPage = Number(searchParams.get('perPage') ?? '25');
  const search = searchParams.get('search') ?? '';
  const active = searchParams.get('active') ?? '';
  const sort = (searchParams.get('sort') as SortKey) ?? 'lastName';
  const dir = (searchParams.get('dir') as 'asc' | 'desc') ?? 'asc';

  const updateParams = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set('accountType', accountType);
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      router.push(`${routes.bema.users()}?${next.toString()}`);
    },
    [accountType, router, searchParams],
  );

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      accountType,
      page: String(page),
      perPage: String(perPage),
      sort,
      dir,
      ...(search ? { search } : {}),
      ...(active ? { active } : {}),
    });
    fetch(`/api/bema/users?${params.toString()}`, { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? 'Failed to load users.');
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setRows(data.items);
        setTotal(data.total);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load users.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountType, page, perPage, search, active, sort, dir]);

  const columns: Column<ListRow>[] = [
    { key: 'lastName', label: 'Name', sortable: true, render: (r) => `${r.lastName ?? ''}, ${r.firstName ?? ''}` },
    { key: 'username', label: 'Username', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'active', label: 'Status', render: (r) => (r.active ? 'Active' : 'Inactive') },
    {
      key: 'actions',
      label: '',
      render: (r) => <Link href={routes.bema.userEdit(r.id)}>Edit</Link>,
    },
  ];

  return (
    <div>
      <h1 className={s.heading}>{accountType === 'BemaUser' ? 'BEMA Users' : 'Customers'}</h1>

      {error && <Alert variant="error">{error}</Alert>}

      <div className={s.filterBar}>
        <Select
          instanceId="user-list-active"
          options={ACTIVE_OPTIONS}
          value={active}
          onChange={(value) => updateParams({ active: value, page: '1' })}
        />
        <Select
          instanceId="user-list-perpage"
          options={PER_PAGE_OPTIONS}
          value={String(perPage)}
          onChange={(value) => updateParams({ perPage: value || '25', page: '1' })}
        />
        <Input
          placeholder="Search…"
          defaultValue={search}
          onKeyDown={(e) => {
            if (e.key === 'Enter') updateParams({ search: (e.target as HTMLInputElement).value, page: '1' });
          }}
        />
        <div className={s.spacer} />
        <Link href={`${routes.bema.userNew()}?accountType=${accountType}`}>
          <Button type="button">Add {accountType === 'BemaUser' ? 'BEMA User' : 'Customer'}</Button>
        </Link>
      </div>

      <Table
        columns={columns}
        rows={rows}
        sort={{ key: sort, dir }}
        onSort={(key) => updateParams({ sort: key, dir: sort === key && dir === 'asc' ? 'desc' : 'asc' })}
        getRowKey={(r) => r.id}
        emptyMessage={loading ? 'Loading…' : 'No records found.'}
      />

      <Pagination page={page} perPage={perPage} total={total} onPageChange={(p) => updateParams({ page: String(p) })} />
    </div>
  );
}
