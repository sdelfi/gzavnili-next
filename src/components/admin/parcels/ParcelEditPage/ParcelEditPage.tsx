'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { PageHeading } from '@/components/ui/PageHeading';
import { useBemaAuth } from '@/components/admin/AuthProvider';
import { ParcelDetailsSection } from '@/components/admin/parcels/ParcelDetailsSection';
import { ParcelReceiverSection } from '@/components/admin/parcels/ParcelReceiverSection';
import { ParcelCustomerSection } from '@/components/admin/parcels/ParcelCustomerSection';
import { ParcelPricingSection } from '@/components/admin/parcels/ParcelPricingSection';
import { ParcelTrackingDatesSection } from '@/components/admin/parcels/ParcelTrackingDatesSection';
import { getParcel, updateParcel } from '@/lib/api/bema/parcels';
import { listUsers } from '@/lib/api/bema/users';
import { ApiError } from '@/lib/api/http';
import { parcelDetailToForm, parcelFormToPayload, type ParcelFormState } from '@/lib/parcels/form';
import { formatAmount } from '@/lib/parcels/format';
import { routes } from '@/lib/routes';
import type { ParcelDetail } from '@/lib/services/parcelDetail';
import s from './ParcelEditPage.module.css';

// The parcel edit screen — `bema/parcels/parcels-update.cfm` + `views/parcels/
// vwParcelsUpdate.cfm` (1,441 lines of view, six jQuery/Prototype handlers and a dozen ajax
// endpoints). This component owns the form state and the save; each of the five fieldsets is
// its own component, matching how the legacy form is grouped.
//
// Two things are deliberately not on this form even though legacy has them:
//
// * **The "Add" mode.** Legacy serves add and edit from one file switched by `nrc=1`, with
//   different defaults, a different button row and a `Save & Add Another` flow. That's a
//   separate screen's worth of behaviour; this is the edit screen, and add comes next.
// * **The Invoice File upload/preview row.** It belongs to the files module, which has not
//   been ported.

/** Flattens zod's `{ fieldErrors: { 'receiver.city': [...] } }` into `field → first message`,
 *  including the nested paths the receiver/customer sections look themselves up by. */
function toFieldErrors(body: unknown): { fields: Record<string, string>; form: string[] } {
  const error = (body as { error?: { formErrors?: string[]; fieldErrors?: Record<string, string[]> } })?.error;
  if (!error || typeof error === 'string') return { fields: {}, form: [] };

  const fields: Record<string, string> = {};
  for (const [key, messages] of Object.entries(error.fieldErrors ?? {})) {
    if (messages?.[0]) fields[key] = messages[0];
  }
  return { fields, form: error.formErrors ?? [] };
}

export function ParcelEditPage({ parcelId }: { parcelId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useBemaAuth();

  const [original, setOriginal] = useState<ParcelDetail | null>(null);
  const [form, setForm] = useState<ParcelFormState | null>(null);
  const [admins, setAdmins] = useState<{ id: string; name: string }[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Where the list sent us from, so Save/Cancel land back on the same filtered page —
  // legacy threads the same thing through as its `rs` querystring param.
  const returnTo = searchParams.get('returnTo') || routes.bema.parcels();

  useEffect(() => {
    let cancelled = false;
    getParcel(parcelId)
      .then(({ parcel }) => {
        if (cancelled) return;
        setOriginal(parcel);
        setForm(parcelDetailToForm(parcel));
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load parcel.');
      });
    return () => {
      cancelled = true;
    };
  }, [parcelId]);

  useEffect(() => {
    let cancelled = false;
    listUsers<{ id: string; firstName: string | null; lastName: string | null; username: string }>({
      accountType: 'BemaUser',
      page: 1,
      perPage: 500,
      sort: 'lastName',
      dir: 'asc',
      active: 'true',
    })
      .then((data) => {
        if (cancelled) return;
        setAdmins(
          data.items.map((a) => ({
            id: a.id,
            name: `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim() || a.username,
          })),
        );
      })
      .catch(() => {
        // Only the two "who handled it" dropdowns degrade; the rest of the form is fine.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const set = useCallback(<K extends keyof ParcelFormState>(key: K, value: ParcelFormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const setReceiver = useCallback(
    <K extends keyof ParcelFormState['receiver']>(key: K, value: ParcelFormState['receiver'][K]) => {
      setForm((prev) => (prev ? { ...prev, receiver: { ...prev.receiver, [key]: value } } : prev));
    },
    [],
  );

  const setCustomer = useCallback(
    <K extends keyof ParcelFormState['customer']>(key: K, value: ParcelFormState['customer'][K]) => {
      setForm((prev) => (prev ? { ...prev, customer: { ...prev.customer, [key]: value } } : prev));
    },
    [],
  );

  /** Returns whether the save went through, so "Save & close" only navigates on success —
   *  leaving the operator on the form with the errors otherwise. */
  async function save(): Promise<boolean> {
    if (!form || !original) return false;

    setSaving(true);
    setFieldErrors({});
    setFormErrors([]);
    setNotice(null);
    try {
      const { parcel } = await updateParcel(parcelId, parcelFormToPayload(form, original));
      if (parcel) {
        // Re-seed from what actually got stored: the save can change values the form didn't
        // send (the trigger-derived status, and `isPaid` when this save marked it paid).
        setOriginal(parcel);
        setForm(parcelDetailToForm(parcel));
      }
      setNotice('Parcel has been successfully modified.');
      return true;
    } catch (err) {
      if (err instanceof ApiError) {
        const { fields, form: formLevel } = toFieldErrors(err.body);
        setFieldErrors(fields);
        setFormErrors(formLevel.length ? formLevel : Object.keys(fields).length ? [] : [err.message]);
      } else {
        setFormErrors([err instanceof Error ? err.message : 'Save failed.']);
      }
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await save();
  }

  if (loadError) return <Alert variant="error">{loadError}</Alert>;
  if (!form || !original) return <p className={s.loading}>Loading…</p>;

  return (
    <form className={s.page} onSubmit={handleSubmit} noValidate>
      <PageHeading
        meta={
          <>
            {original.trackingNum} · status <b>{original.status}</b>
            {original.pcode && <> · code {original.pcode}</>}
            {original.debt !== null && <> · debt {formatAmount(original.debt)}</>}
          </>
        }
      >
        Edit Parcel
      </PageHeading>

      {notice && <Alert variant="success">{notice}</Alert>}
      {formErrors.length > 0 && (
        <Alert variant="error">
          <ul>
            {formErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Alert>
      )}
      {Object.keys(fieldErrors).length > 0 && formErrors.length === 0 && (
        <Alert variant="error">Please correct the highlighted fields.</Alert>
      )}

      <div className={s.columns}>
        <div className={s.column}>
          <ParcelDetailsSection form={form} set={set} errors={fieldErrors} parcelId={parcelId} />
          <ParcelReceiverSection form={form} setReceiver={setReceiver} set={set} errors={fieldErrors} />
          <ParcelCustomerSection form={form} setCustomer={setCustomer} disabled={!form.userId} />
        </div>
        <div className={s.column}>
          <ParcelPricingSection
            form={form}
            set={set}
            errors={fieldErrors}
            adminCountry={user?.billingAddress?.country ?? null}
            isPaid={original.isPaid}
          />
          <ParcelTrackingDatesSection form={form} set={set} admins={admins} />
        </div>
      </div>

      <div className={s.actions}>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={saving}
          onClick={async () => {
            if (await save()) router.push(returnTo);
          }}
        >
          Save &amp; close
        </Button>
        <Link href={returnTo} className={s.cancel}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
