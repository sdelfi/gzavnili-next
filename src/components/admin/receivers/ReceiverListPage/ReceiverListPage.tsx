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
import { PageHeading } from '@/components/ui/PageHeading';
import { routes } from '@/lib/routes';
import { listReceiversAdmin, deleteReceiver } from '@/lib/api/bema/receivers';
import s from './ReceiverListPage.module.css';

type ListRow = {
  id: string;
  active: boolean;
  label: string;
  customerLabel: string;
  address: { city: string; country: string; state: string };
};
type SortKey = 'lastName' | 'firstName';

const ACTIVE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];
const PER_PAGE_OPTIONS = ['25', '50', '75', '100', '250', '500'].map((v) => ({ value: v, label: v }));

// Standalone Receivers browse/search screen — legacy `bema/parcels/receivers.cfm`. Distinct
// from the parcel form's inline receiver picker (`ParcelReceiverSection`): this lets an
// operator manage a receiver directly (fix an address, deactivate one) without a parcel in
// the loop — see docs/decisions for why that path didn't exist yet before this screen.
export function ReceiverListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<ListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumped after a successful delete to force the list effect below to refetch.
  const [reloadToken, setReloadToken] = useState(0);

  const page = Number(searchParams.get('page') ?? '1');
  const perPage = Number(searchParams.get('perPage') ?? '25');
  const search = searchParams.get('search') ?? '';
  // Legacy `receivers.cfm` defaults to `status=1` (active only) on first load.
  const active = searchParams.get('active') ?? 'true';
  const sort = (searchParams.get('sort') as SortKey) ?? 'lastName';
  const dir = (searchParams.get('dir') as 'asc' | 'desc') ?? 'asc';

  const updateParams = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      router.push(`${routes.bema.receivers()}?${next.toString()}`);
    },
    [router, searchParams],
  );

  useEffect(() => {
    let cancelled = false;
    listReceiversAdmin<ListRow>({ page, perPage, sort, dir, search, active })
      .then((data) => {
        if (cancelled) return;
        setRows(data.items);
        setTotal(data.total);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load receivers.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, perPage, search, active, sort, dir, reloadToken]);

  const returnTo = `${routes.bema.receivers()}?${searchParams.toString()}`;

  async function handleDelete(id: string) {
    if (!window.confirm('Are you sure you want to delete this receiver?')) return;
    try {
      await deleteReceiver(id);
      setReloadToken((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete receiver.');
    }
  }

  const columns: Column<ListRow>[] = [
    { key: 'lastName', label: 'Name', sortable: true, render: (r) => r.label },
    { key: 'customer', label: 'Customer', render: (r) => r.customerLabel },
    { key: 'city', label: 'City', render: (r) => r.address.city },
    { key: 'state', label: 'State', render: (r) => r.address.state },
    { key: 'country', label: 'Country', render: (r) => r.address.country },
    { key: 'active', label: 'Status', render: (r) => (r.active ? 'Active' : 'Inactive') },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className={s.actions}>
          <Link href={`${routes.bema.receiverEdit(r.id)}?returnTo=${encodeURIComponent(returnTo)}`}>Edit</Link>
          {r.active && (
            <button type="button" onClick={() => handleDelete(r.id)}>
              Delete
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeading>Receivers</PageHeading>

      {error && <Alert variant="error">{error}</Alert>}

      <div className={s.filterBar}>
        <div className={s.filterControl}>
          <Select
            instanceId="receiver-list-active"
            options={ACTIVE_OPTIONS}
            value={active}
            onChange={(value) => updateParams({ active: value, page: '1' })}
          />
        </div>
        <div className={s.filterControl}>
          <Select
            instanceId="receiver-list-perpage"
            options={PER_PAGE_OPTIONS}
            value={String(perPage)}
            onChange={(value) => updateParams({ perPage: value || '25', page: '1' })}
          />
        </div>
        <div className={s.searchControl}>
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
        <Link href={`${routes.bema.receiverNew()}?returnTo=${encodeURIComponent(returnTo)}`}>
          <Button type="button">Add Receiver</Button>
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
