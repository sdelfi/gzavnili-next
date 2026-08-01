'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert } from '@/components/ui/admin/Alert';
import { PageHeading } from '@/components/ui/admin/PageHeading';
import { useBemaAuth } from '@/components/admin/AuthProvider';
import { ParcelTripInfo } from '@/components/admin/parcels/ParcelTripInfo';
import { ParcelAddCustomerSection } from '@/components/admin/parcels/ParcelAddCustomerSection';
import { ParcelDraftTable } from '@/components/admin/parcels/ParcelDraftTable';
import { ParcelDraftModal } from '@/components/admin/parcels/ParcelDraftModal';
import {
  ParcelAddPaymentSection,
  blankPaymentForm,
  type PaymentFormState,
} from '@/components/admin/parcels/ParcelAddPaymentSection';
import { defaultTrackingCore, trackingPrefix } from '@/components/admin/parcels/ParcelDraftFields';
import { createParcelsBatch } from '@/lib/api/bema/parcels';
import { listUsers } from '@/lib/api/bema/users';
import { listPricingRules } from '@/lib/api/bema/pricingRules';
import { ApiError, extractErrorMessages } from '@/lib/api/http';
import {
  blankDraftParcel,
  blankQuickCustomer,
  draftParcelToPayload,
  quickCustomerToCustomerFields,
  type DraftParcelFormState,
  type QuickCustomerFormState,
} from '@/lib/parcels/batchForm';
import { resolveAgentFlatRate } from '@/lib/parcels/batchPricing';
import type { PricingRule } from '@/lib/parcels/pricing';
import type { AddParcelBatchPayload } from '@/lib/validation/parcelBatchSchema';
import { routes } from '@/lib/routes';

// The batch "Add Parcel" screen — `bema/parcels/parcels-add.cfm` + `views/parcels/
// vwParcelsAdd.cfm`. Distinct from the single-parcel edit screen (`ParcelEditPage`): one
// customer, several draft parcels (each its own receiver) held in memory and created
// together, with a shared delivery-fee/minimum-charge calculation per `groupId` and a
// two-payment-method split across the whole batch — see `batchPricing.ts` for that math and
// `parcelBatchAdd.ts` for what it feeds into.
//
// Deliberately not ported, and why:
// * The tmp-table tracking-number reservation (`bema/ajax/tmpTracking.cfm`) that let legacy
//   coordinate drafts across page loads/tabs — this screen keeps its drafts in React state
//   instead of round-tripping through the server on every add, so there's nothing to
//   reserve; the final submit's own uniqueness check (shared with the edit screen) is what
//   actually has to hold.
// * The agent tracking-number prefix (`agent-prefix-map.cfm`) — keys off legacy MSSQL ids
//   that don't exist in this schema. Flagged in docs/decisions/0017, not silently dropped.
//   The BEMA-agent flat-rate override itself *is* ported — see `resolveAgentFlatRate()`
//   below, applied to the live preview the same way `parcelBatchAdd.ts` applies it
//   server-side at submit.
// * `generateNewTracking()`'s recursive ajax-backed uniqueness search for "Duplicate" — this
//   just reseeds the default time-based core and lets the final submit's own duplicate check
//   catch a real collision, rather than looping ajax calls for what's a rare edge case.

export function ParcelAddPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useBemaAuth();

  const returnTo = searchParams.get('returnTo') || routes.bema.parcels();

  const [customer, setCustomerState] = useState<QuickCustomerFormState>(blankQuickCustomer());
  const [resolvedUserId, setResolvedUserId] = useState('');
  const [admins, setAdmins] = useState<{ id: string; name: string }[]>([]);
  const [rules, setRules] = useState<{ userId: string; rules: PricingRule[] }>({ userId: '', rules: [] });
  const [drafts, setDrafts] = useState<DraftParcelFormState[]>([]);
  const [editing, setEditing] = useState<{ draft: DraftParcelFormState; isEdit: boolean } | null>(null);
  const [payment, setPaymentState] = useState<PaymentFormState>(blankPaymentForm());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

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
          data.items.map((a) => ({ id: a.id, name: `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim() || a.username })),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!resolvedUserId) return;
    let cancelled = false;
    listPricingRules<PricingRule>(resolvedUserId)
      .then((data) => !cancelled && setRules({ userId: resolvedUserId, rules: data.rules }))
      .catch(() => !cancelled && setRules({ userId: resolvedUserId, rules: [] }));
    return () => {
      cancelled = true;
    };
  }, [resolvedUserId]);

  const setCustomer = useCallback(
    <K extends keyof QuickCustomerFormState>(key: K, value: QuickCustomerFormState[K]) => {
      setCustomerState((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );
  const setPayment = useCallback(<K extends keyof PaymentFormState>(key: K, value: PaymentFormState[K]) => {
    setPaymentState((prev) => ({ ...prev, [key]: value }));
  }, []);

  function handleResolved(userId: string) {
    setResolvedUserId(userId);
    if (!userId) setDrafts([]);
  }

  function openNewDraft() {
    // Auto-detect delivery/service from group "1"'s first existing parcel, same as legacy's
    // `#addParcel` `show.bs.modal` handler.
    const groupOneFirst = drafts.find((d) => d.groupId === '1');
    const seed = blankDraftParcel({
      groupId: '1',
      delivery: groupOneFirst?.delivery,
      service: groupOneFirst?.service,
      trackingReceivedBy: user?.id,
    });
    seed.trackingNum = `${trackingPrefix(seed.delivery, seed.service)}${defaultTrackingCore()}`;
    setEditing({ draft: seed, isEdit: false });
  }

  function openEditDraft(clientId: string) {
    const found = drafts.find((d) => d.clientId === clientId);
    if (found) setEditing({ draft: found, isEdit: true });
  }

  function duplicateDraft(clientId: string) {
    const found = drafts.find((d) => d.clientId === clientId);
    if (!found) return;
    const prefix = trackingPrefix(found.delivery, found.service);
    setDrafts((prev) => [
      ...prev,
      { ...found, clientId: crypto.randomUUID(), trackingNum: `${prefix}${defaultTrackingCore()}` },
    ]);
  }

  function removeDraft(clientId: string) {
    if (!window.confirm('Are you sure you want to remove this parcel?')) return;
    setDrafts((prev) => prev.filter((d) => d.clientId !== clientId));
  }

  function saveDraft(draft: DraftParcelFormState) {
    setDrafts((prev) => {
      const exists = prev.some((d) => d.clientId === draft.clientId);
      return exists ? prev.map((d) => (d.clientId === draft.clientId ? draft : d)) : [...prev, draft];
    });
    setEditing(null);
  }

  async function handleSubmit() {
    if (!resolvedUserId || drafts.length === 0) return;
    setSaving(true);
    setErrors([]);
    try {
      const payload: AddParcelBatchPayload = {
        userId: resolvedUserId,
        customer: quickCustomerToCustomerFields(customer),
        notifications: payment.notifications,
        paymentMethod1: payment.paymentMethod1,
        paymentAmount1: payment.paymentAmount1,
        paymentMethod2: payment.paymentMethod2,
        paymentAmount2: payment.paymentAmount2,
        priceTotal: payment.priceTotal,
        draftParcels: drafts.map(draftParcelToPayload),
      };
      await createParcelsBatch(payload);
      router.push(returnTo);
    } catch (err) {
      if (err instanceof ApiError) setErrors(extractErrorMessages(err.body));
      else setErrors([err instanceof Error ? err.message : 'Save failed.']);
    } finally {
      setSaving(false);
    }
  }

  const activeRules = rules.userId === resolvedUserId ? rules.rules : [];
  // For the on-screen preview only — the authoritative calculation is server-side, re-derived
  // independently in `parcelBatchAdd.ts` from the acting session, not trusted from the client.
  const agentFlatRate = resolveAgentFlatRate({
    isAgent: user?.adminRole === 'BemaAgent',
    agentPrice: user?.agentPrice ? Number(user.agentPrice) : null,
    username: user?.username ?? '',
  });

  return (
    <div>
      <ParcelTripInfo />

      <PageHeading>Add Parcel</PageHeading>

      {errors.length > 0 && (
        <Alert variant="error">
          <ul>
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Alert>
      )}

      <ParcelAddCustomerSection
        customer={customer}
        setCustomer={setCustomer}
        resolvedUserId={resolvedUserId}
        onResolved={handleResolved}
      />

      <ParcelDraftTable
        drafts={drafts}
        rules={activeRules}
        agentFlatRate={agentFlatRate}
        onEdit={openEditDraft}
        onDuplicate={duplicateDraft}
        onRemove={removeDraft}
      />

      <ParcelAddPaymentSection
        form={payment}
        set={setPayment}
        adminCountry={user?.billingAddress?.country ?? null}
        errors={{}}
        onAdd={openNewDraft}
        addDisabled={!resolvedUserId}
        onSubmit={handleSubmit}
        saving={saving}
        submitDisabled={saving || !resolvedUserId || drafts.length === 0}
      />

      {editing && (
        <ParcelDraftModal
          key={editing.draft.clientId}
          open
          onClose={() => setEditing(null)}
          draft={editing.draft}
          isEdit={editing.isEdit}
          userId={resolvedUserId}
          admins={admins}
          onSave={saveDraft}
        />
      )}
    </div>
  );
}
