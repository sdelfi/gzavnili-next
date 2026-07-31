'use client';

import { Suspense, use, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { PageHeading } from '@/components/ui/PageHeading';
import { ReceiverForm, type ReceiverFormValues } from '@/components/admin/receivers/ReceiverForm';
import { getReceiver } from '@/lib/api/bema/receivers';

type RawReceiver = {
  id: string;
  userId: string | null;
  active: boolean;
  isGeCitizen: boolean;
  customerLabel: string;
  address: Partial<Record<keyof ReceiverFormValues, string>>;
};

function EditReceiverPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? undefined;
  const [receiver, setReceiver] = useState<RawReceiver | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getReceiver<RawReceiver>(id)
      .then((data) => setReceiver(data.receiver))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load receiver.'));
  }, [id]);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!receiver) return <div>Loading…</div>;

  const initialValues: Partial<ReceiverFormValues> = {
    ...receiver.address,
    userId: receiver.userId ?? '',
    customerLabel: receiver.customerLabel,
    active: receiver.active,
    isGeCitizen: receiver.isGeCitizen,
  };

  return (
    <div>
      <PageHeading>Edit Receiver</PageHeading>
      <ReceiverForm initialValues={initialValues} receiverId={receiver.id} returnTo={returnTo} />
    </div>
  );
}

export default function EditReceiverPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <EditReceiverPageInner {...props} />
    </Suspense>
  );
}
