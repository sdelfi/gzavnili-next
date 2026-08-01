'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Table, type Column } from '@/components/ui/admin/Table';
import { Pagination } from '@/components/ui/admin/Pagination';
import { Input } from '@/components/ui/admin/Input';
import { Select } from '@/components/ui/admin/Select';
import { Alert } from '@/components/ui/admin/Alert';
import { PageHeading } from '@/components/ui/admin/PageHeading';
import { routes } from '@/lib/routes';
import { listSms, type SmsListItem } from '@/lib/api/bema/messages';
import s from './SmsListPage.module.css';

const PER_PAGE_OPTIONS = ['25', '50', '75', '100', '250', '500'].map((v) => ({ value: v, label: v }));

// bema "SMS list" (legacy `bema/messages/sms.cfm`) — read-only, same shared `messages` table
// as "Messages". See docs/decisions/0021-bema-messages.md.
export function SmsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<SmsListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const page = Number(searchParams.get('page') ?? '1');
  const perPage = Number(searchParams.get('perPage') ?? '25');
  const search = searchParams.get('search') ?? '';

  const updateParams = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      router.push(`${routes.bema.smsList()}?${next.toString()}`);
    },
    [router, searchParams],
  );

  useEffect(() => {
    let cancelled = false;
    listSms({ page, perPage, search: search || undefined })
      .then((data) => {
        if (cancelled) return;
        setRows(data.items);
        setTotal(data.total);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load SMS messages.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, perPage, search]);

  const columns: Column<SmsListItem>[] = [
    { key: 'smsTo', label: 'to Phone', render: (r) => r.smsTo ?? '' },
    { key: 'trackingNum', label: 'Parcel trackingnum', render: (r) => r.trackingNum ?? '' },
    { key: 'smsBody', label: 'Message', render: (r) => r.smsBody ?? '' },
    { key: 'createdAt', label: 'Date', render: (r) => new Date(r.createdAt).toLocaleString() },
  ];

  return (
    <div>
      <PageHeading>Browse Messages</PageHeading>

      {error && <Alert variant="error">{error}</Alert>}

      <div className={s.filterBar}>
        <div className={s.filterControl}>
          <Select
            instanceId="sms-list-perpage"
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
      </div>

      <Table
        columns={columns}
        rows={rows}
        getRowKey={(r) => String(r.id)}
        emptyMessage={loading ? 'Loading…' : 'There are no messages in this view.'}
      />

      <Pagination page={page} perPage={perPage} total={total} onPageChange={(p) => updateParams({ page: String(p) })} />
    </div>
  );
}
