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
import { IconButton } from '@/components/ui/IconButton';
import { routes } from '@/lib/routes';
import s from './PageListPage.module.css';

type ListRow = { id: string; slug: string; locale: string; name: string; updatedAt: string };
type SortKey = 'name' | 'slug' | 'updatedAt';

const LOCALE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'en', label: 'English' },
  { value: 'ge', label: 'Georgian' },
];
const PER_PAGE_OPTIONS = ['25', '50', '75', '100', '250', '500'].map((v) => ({ value: v, label: v }));

// bema "Site Pages" list — legacy `bema/content/pages.cfm`. See
// docs/decisions/0013-site-pages-cms.md for the full CMS architecture (Postgres-backed,
// on-demand ISR revalidation instead of legacy's hand-rolled file cache).
export function PageListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<ListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const page = Number(searchParams.get('page') ?? '1');
  const perPage = Number(searchParams.get('perPage') ?? '25');
  const search = searchParams.get('search') ?? '';
  const locale = searchParams.get('locale') ?? '';
  const sort = (searchParams.get('sort') as SortKey) ?? 'name';
  const dir = (searchParams.get('dir') as 'asc' | 'desc') ?? 'asc';

  const updateParams = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      router.push(`${routes.bema.pages()}?${next.toString()}`);
    },
    [router, searchParams],
  );

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      page: String(page),
      perPage: String(perPage),
      sort,
      dir,
      ...(search ? { search } : {}),
      ...(locale ? { locale } : {}),
    });
    fetch(`/api/bema/pages?${params.toString()}`, { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? 'Failed to load pages.');
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
        setError(err instanceof Error ? err.message : 'Failed to load pages.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, perPage, search, locale, sort, dir]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this page? This cannot be undone.')) return;
    const res = await fetch(`/api/bema/pages/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? 'Failed to delete page.');
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    setTotal((prev) => prev - 1);
  }

  const returnTo = `${routes.bema.pages()}?${searchParams.toString()}`;

  const columns: Column<ListRow>[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'slug', label: 'URL', sortable: true, render: (r) => (r.locale === 'ge' ? `/ge/${r.slug}` : `/${r.slug}`) },
    { key: 'locale', label: 'Locale', render: (r) => (r.locale === 'ge' ? 'Georgian' : 'English') },
    { key: 'updatedAt', label: 'Modified', sortable: true, render: (r) => new Date(r.updatedAt).toLocaleDateString() },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className={s.actions}>
          <Link href={`${routes.bema.pageEdit(r.id)}?returnTo=${encodeURIComponent(returnTo)}`}>
            <IconButton icon="edit" title="Edit" />
          </Link>
          <button type="button" className={s.iconButtonReset} onClick={() => handleDelete(r.id)}>
            <IconButton icon="delete" title="Delete" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h1 className={s.heading}>Site Pages</h1>

      {error && <Alert variant="error">{error}</Alert>}

      <div className={s.filterBar}>
        <div className={s.filterControl}>
          <Select
            instanceId="page-list-locale"
            options={LOCALE_OPTIONS}
            value={locale}
            onChange={(value) => updateParams({ locale: value, page: '1' })}
          />
        </div>
        <div className={s.filterControl}>
          <Select
            instanceId="page-list-perpage"
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
        <Link href={`${routes.bema.pageNew()}?returnTo=${encodeURIComponent(returnTo)}`}>
          <Button type="button">Add Page</Button>
        </Link>
      </div>

      <Table
        columns={columns}
        rows={rows}
        sort={{ key: sort, dir }}
        onSort={(key) => updateParams({ sort: key, dir: sort === key && dir === 'asc' ? 'desc' : 'asc' })}
        getRowKey={(r) => r.id}
        emptyMessage={loading ? 'Loading…' : 'No pages found.'}
      />

      <Pagination page={page} perPage={perPage} total={total} onPageChange={(p) => updateParams({ page: String(p) })} />
    </div>
  );
}
