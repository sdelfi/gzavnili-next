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
import { deleteMessage, listMessages, setMessageActive, type MessageListItem } from '@/lib/api/bema/messages';
import s from './MessagesListPage.module.css';

const PER_PAGE_OPTIONS = ['25', '50', '75', '100', '250', '500'].map((v) => ({ value: v, label: v }));

// bema "Messages" (legacy `bema/messages/messages.cfm`) — see
// docs/decisions/0021-bema-messages.md and docs/decisions/0033-bema-send-message.md. Legacy's
// actions column has both a "Reply" and a "View" link, but both point at the exact same
// `message_view.cfm?id=...` URL — reproduced as a single "View" action rather than two links
// to the same place.
export function MessagesListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<MessageListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const page = Number(searchParams.get('page') ?? '1');
  const perPage = Number(searchParams.get('perPage') ?? '25');
  const search = searchParams.get('search') ?? '';
  const chainParam = searchParams.get('chain') ?? '';

  const updateParams = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      router.push(`${routes.bema.messages()}?${next.toString()}`);
    },
    [router, searchParams],
  );

  useEffect(() => {
    let cancelled = false;
    const chain = chainParam ? Number(chainParam) : undefined;
    listMessages({ page, perPage, search: search || undefined, chain })
      .then((data) => {
        if (cancelled) return;
        setRows(data.items);
        setTotal(data.total);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load messages.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, perPage, search, chainParam]);

  async function handleToggleActive(row: MessageListItem) {
    try {
      const data = await setMessageActive(row.id, !row.active);
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, active: data.message.active } : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update message.');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this message? This cannot be undone.')) return;
    try {
      await deleteMessage(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setTotal((prev) => prev - 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete message.');
    }
  }

  const columns: Column<MessageListItem>[] = [
    { key: 'id', label: 'ID' },
    { key: 'chain', label: 'Chain', render: (r) => r.chain ?? '' },
    {
      key: 'replyToId',
      label: 'Reply to',
      render: (r) => (r.replyToId != null ? <Link href={routes.bema.messageView(r.replyToId)}>{r.replyToId}</Link> : ''),
    },
    { key: 'senderUsername', label: 'Sender (from)', render: (r) => r.senderUsername ?? '' },
    { key: 'username', label: 'User (to)', render: (r) => r.username ?? '' },
    { key: 'trackingNum', label: 'Parcel', render: (r) => r.trackingNum ?? '' },
    { key: 'subject', label: 'Subject', render: (r) => r.subject ?? '' },
    // Legacy's own "Message" column shows the message *type* label, not the body text — see
    // docs/findings.md's "Messages" section.
    { key: 'messageTypeLabel', label: 'Message', render: (r) => r.messageTypeLabel ?? '' },
    { key: 'createdAt', label: 'Date', render: (r) => new Date(r.createdAt).toLocaleString() },
    {
      key: 'active',
      label: 'Status',
      render: (r) => (
        <Button type="button" variant="link" onClick={() => handleToggleActive(r)}>
          {r.active ? 'Active' : 'Inactive'}
        </Button>
      ),
    },
    { key: 'read', label: 'Read?', render: (r) => (r.read ? 'Read' : 'Unread') },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <div className={s.actions}>
          <Link href={routes.bema.messageView(r.id)}>
            <IconButton icon="view" title="View" />
          </Link>
          <IconButton icon="delete" title="Delete" onClick={() => handleDelete(r.id)} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeading>Browse Messages</PageHeading>

      {error && <Alert variant="error">{error}</Alert>}

      <div className={s.filterBar}>
        <div className={s.filterControl}>
          <Select
            instanceId="messages-list-perpage"
            options={PER_PAGE_OPTIONS}
            value={String(perPage)}
            onChange={(value) => updateParams({ perPage: value || '25', page: '1' })}
          />
        </div>
        <div className={s.filterControl}>
          <Input
            type="text"
            placeholder="Chain"
            defaultValue={chainParam}
            onKeyDown={(e) => {
              if (e.key === 'Enter') updateParams({ chain: (e.target as HTMLInputElement).value, page: '1' });
            }}
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
        <Link href={routes.bema.messageAdd()}>
          <Button type="button">Send message</Button>
        </Link>
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
