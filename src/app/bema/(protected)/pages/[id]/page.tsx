'use client';

import { Suspense, use, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { PageForm, type PageFormValues } from '@/components/admin/pages/PageForm';

type RawPage = Partial<PageFormValues> & { id: string };

function EditPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? undefined;
  const [page, setPage] = useState<RawPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/bema/pages/${id}`, { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? 'Failed to load page.');
        }
        return res.json();
      })
      .then((data) => setPage(data.page))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load page.'));
  }, [id]);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!page) return <div>Loading…</div>;

  return (
    <div>
      <h1>Edit Page</h1>
      <PageForm
        initialValues={{
          ...page,
          header: page.header ?? '',
          metaTitle: page.metaTitle ?? '',
          metaDescription: page.metaDescription ?? '',
          metaKeywords: page.metaKeywords ?? '',
        }}
        pageId={page.id}
        returnTo={returnTo}
      />
    </div>
  );
}

export default function EditBemaPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <EditPageInner {...props} />
    </Suspense>
  );
}
