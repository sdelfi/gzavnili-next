'use client';

import { Suspense, use, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { PageHeading } from '@/components/ui/PageHeading';
import { PageForm, type PageFormValues } from '@/components/admin/pages/PageForm';
import { getPage } from '@/lib/api/bema/pages';

type RawPage = Partial<PageFormValues> & { id: string };

function EditPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? undefined;
  const [page, setPage] = useState<RawPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPage<RawPage>(id)
      .then((data) => setPage(data.page))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load page.'));
  }, [id]);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!page) return <div>Loading…</div>;

  return (
    <div>
      <PageHeading>Edit Page</PageHeading>
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
