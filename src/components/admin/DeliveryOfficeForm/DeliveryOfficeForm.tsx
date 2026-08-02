'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/admin/Input';
import { Checkbox } from '@/components/ui/admin/Checkbox';
import { Button } from '@/components/ui/admin/Button';
import { ErrorList } from '@/components/ui/admin/Alert';
import { CollapsibleSection } from '@/components/ui/admin/CollapsibleSection';
import { routes } from '@/lib/routes';
import { createDeliveryOffice, updateDeliveryOffice } from '@/lib/api/bema/deliveryOffices';
import { ApiError, extractErrorMessages } from '@/lib/api/http';
import s from './DeliveryOfficeForm.module.css';

export type DeliveryOfficeFormValues = {
  city: string;
  officeName: string;
  officeNameGe: string;
  letter: string;
  active: boolean;
};

const FIELD_LABELS: Record<string, string> = {
  city: 'City',
  officeName: 'Office Name',
  officeNameGe: 'Office Name (GE)',
  letter: 'Letter',
};

// bema "Add/Edit Delivery Office" — legacy `bema/config/office_edit.cfm` +
// `views/config/vwOfficeEditForm.cfm`. See docs/decisions/0030-georgian-offices.md. Legacy's
// own "Search Patterns" field is commented out of this form entirely — not reproduced here
// either, since every save already wipes that column server-side regardless of what a form
// might submit (see the decision doc).
export function DeliveryOfficeForm({
  initialValues,
  officeId,
  returnTo,
}: {
  initialValues?: Partial<DeliveryOfficeFormValues>;
  officeId?: string;
  returnTo?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<DeliveryOfficeFormValues>({
    city: initialValues?.city ?? '',
    officeName: initialValues?.officeName ?? '',
    officeNameGe: initialValues?.officeNameGe ?? '',
    letter: initialValues?.letter ?? '',
    // Legacy's own default for a brand-new record is Active.
    active: initialValues?.active ?? true,
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof DeliveryOfficeFormValues>(key: K, value: DeliveryOfficeFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    setSubmitting(true);
    try {
      if (officeId) {
        await updateDeliveryOffice(officeId, values);
      } else {
        await createDeliveryOffice(values);
      }
      router.push(returnTo || routes.bema.deliveryOffices());
    } catch (err) {
      setErrors(err instanceof ApiError ? extractErrorMessages(err.body, FIELD_LABELS) : ['Save failed.']);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={s.form} onSubmit={handleSubmit}>
      <ErrorList errors={errors} />

      <CollapsibleSection title="Account Information">
        <div className={s.grid}>
          <label className={s.field}>
            City*
            <Input value={values.city} onChange={(e) => set('city', e.target.value)} maxLength={50} required />
          </label>
          <label className={s.field}>
            Office Name*
            <Input
              value={values.officeName}
              onChange={(e) => set('officeName', e.target.value)}
              maxLength={50}
              required
            />
          </label>
          <label className={s.field}>
            Office Name (GE)
            <Input value={values.officeNameGe} onChange={(e) => set('officeNameGe', e.target.value)} maxLength={50} />
          </label>
          <label className={s.field}>
            Letter*
            <Input value={values.letter} onChange={(e) => set('letter', e.target.value)} maxLength={50} required />
          </label>
          <div className={s.field}>
            <Checkbox checked={values.active} onChange={(e) => set('active', e.target.checked)} label="Active" />
          </div>
        </div>
      </CollapsibleSection>

      <div className={s.actions}>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push(returnTo || routes.bema.deliveryOffices())}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
