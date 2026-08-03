'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Table, type Column } from '@/components/ui/admin/Table';
import { Pagination } from '@/components/ui/admin/Pagination';
import { Input } from '@/components/ui/admin/Input';
import { Select } from '@/components/ui/admin/Select';
import { Button } from '@/components/ui/admin/Button';
import { Alert } from '@/components/ui/admin/Alert';
import { IconButton } from '@/components/ui/admin/IconButton';
import { PageHeading } from '@/components/ui/admin/PageHeading';
import { routes } from '@/lib/routes';
import { listDeliveryOfficesAdmin, type DeliveryOffice } from '@/lib/api/bema/deliveryOffices';
import s from './DeliveryOfficeListPage.module.css';

type SortKey = 'city' | 'officeName' | 'officeNameGe' | 'letter' | 'active';

const STATUS_OPTIONS = [
  { value: '1', label: 'Active' },
  { value: '0', label: 'Inactive' },
  { value: '', label: 'All' },
];
const PER_PAGE_OPTIONS = ['25', '50', '75', '100', '250', '500'].map((v) => ({ value: v, label: v }));

// bema "Georgian Offices" list — legacy `bema/config/offices.cfm` +
// `views/config/vwOffices.cfm`. See docs/decisions/0030-georgian-offices.md.
export function DeliveryOfficeListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<DeliveryOffice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const page = Number(searchParams.get('page') ?? '1');
  const perPage = Number(searchParams.get('perPage') ?? '25');
  const search = searchParams.get('search') ?? '';
  // Legacy's own default is "Active only" until an operator explicitly clears it.
  const active = searchParams.has('active') ? searchParams.get('active')! : '1';
  const sort = (searchParams.get('sort') as SortKey) ?? 'city';
  const dir = (searchParams.get('dir') as 'asc' | 'desc') ?? 'asc';

  const updateParams = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      router.push(`${routes.bema.deliveryOffices()}?${next.toString()}`);
    },
    [router, searchParams],
  );

  useEffect(() => {
    let cancelled = false;
    listDeliveryOfficesAdmin({ page, perPage, sort, dir, search, active })
      .then((data) => {
        if (cancelled) return;
        setRows(data.items);
        setTotal(data.total);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load offices.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, perPage, search, active, sort, dir]);

  const returnTo = `${routes.bema.deliveryOffices()}?${searchParams.toString()}`;

  const columns: Column<DeliveryOffice>[] = [
    { key: 'city', label: 'City', sortable: true },
    { key: 'officeName', label: 'Office Name', sortable: true },
    { key: 'officeNameGe', label: 'Office Name GE', sortable: true },
    { key: 'letter', label: 'Letter', sortable: true },
    { key: 'active', label: 'Active', sortable: true, render: (r) => (r.active ? 'Active' : 'Inactive') },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className={s.actions}>
          <Link href={`${routes.bema.deliveryOfficeEdit(r.id)}?returnTo=${encodeURIComponent(returnTo)}`}>
            <IconButton icon="edit" title="Edit" />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeading>Georgian Offices</PageHeading>

      {error && <Alert variant="error">{error}</Alert>}

      <div className={s.filterBar}>
        <div className={s.filterControl}>
          <Select
            instanceId="office-list-status"
            options={STATUS_OPTIONS}
            value={active}
            onChange={(value) => updateParams({ active: value, page: '1' })}
          />
        </div>
        <div className={s.filterControl}>
          <Select
            instanceId="office-list-perpage"
            options={PER_PAGE_OPTIONS}
            value={String(perPage)}
            onChange={(value) => updateParams({ perPage: value || '25', page: '1' })}
          />
        </div>
        <div className={s.filterControl}>
          <Input
            type="text"
            placeholder="Search…"
            defaultValue={search}
            onKeyDown={(e) => {
              if (e.key === 'Enter') updateParams({ search: (e.target as HTMLInputElement).value, page: '1' });
            }}
          />
        </div>
        <div className={s.spacer} />
        <Link href={`${routes.bema.deliveryOfficeNew()}?returnTo=${encodeURIComponent(returnTo)}`}>
          <Button type="button">Add office</Button>
        </Link>
      </div>

      <Table
        columns={columns}
        rows={rows}
        sort={{ key: sort, dir }}
        onSort={(key) => updateParams({ sort: key, dir: sort === key && dir === 'asc' ? 'desc' : 'asc' })}
        getRowKey={(r) => r.id}
        emptyMessage={loading ? 'Loading…' : 'There are no offices in this view.'}
      />

      <Pagination page={page} perPage={perPage} total={total} onPageChange={(p) => updateParams({ page: String(p) })} />
    </div>
  );
}
