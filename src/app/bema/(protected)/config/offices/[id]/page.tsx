'use client';

import { Suspense, use, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert } from '@/components/ui/admin/Alert';
import { PageHeading } from '@/components/ui/admin/PageHeading';
import { DeliveryOfficeForm } from '@/components/admin/DeliveryOfficeForm';
import { getDeliveryOffice, type DeliveryOffice } from '@/lib/api/bema/deliveryOffices';

function EditDeliveryOfficeInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? undefined;
  const [office, setOffice] = useState<DeliveryOffice | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDeliveryOffice(id)
      .then((data) => setOffice(data.office))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load office.'));
  }, [id]);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!office) return <div>Loading…</div>;

  return (
    <div>
      <PageHeading>Edit Delivery Office</PageHeading>
      <DeliveryOfficeForm
        initialValues={{
          city: office.city ?? '',
          officeName: office.officeName,
          officeNameGe: office.officeNameGe ?? '',
          letter: office.letter ?? '',
          active: office.active,
        }}
        officeId={office.id}
        returnTo={returnTo}
      />
    </div>
  );
}

export default function EditBemaDeliveryOfficePage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <EditDeliveryOfficeInner {...props} />
    </Suspense>
  );
}
