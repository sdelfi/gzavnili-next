'use client';

import { useEffect, useState } from 'react';
import { Field } from '@/components/ui/admin/Field';
import { Input } from '@/components/ui/admin/Input';
import { Button } from '@/components/ui/admin/Button';
import { Alert } from '@/components/ui/admin/Alert';
import { getUser, listUsers } from '@/lib/api/bema/users';
import { saveQuickCustomer } from '@/lib/api/bema/parcels';
import { customerLabel } from '@/components/ui/admin/CustomerPicker';
import { ApiError } from '@/lib/api/http';
import { blankQuickCustomer, quickCustomerToPayload, type QuickCustomerFormState } from '@/lib/parcels/batchForm';
import s from './ParcelAddCustomerSection.module.css';

// The batch "Add Parcel" screen's customer box — legacy's `customerInputs` row plus its
// "Save"/"Update" button, which hits `bema/ajax/customerEdit.cfm` immediately (before any
// parcel can be drafted, since a receiver needs a real customer to belong to). Picking an
// existing customer via search loads their name/billing address the same way; typing one in
// from scratch and pressing "Save" creates the account there and then — see
// `saveQuickCustomer()`'s doc comment for why that's a lighter create than the full
// "New Customer" screen (no username/password on this form, matching legacy).

type CustomerRow = {
  firstName: string | null;
  lastName: string | null;
  organization: string | null;
  billingAddress: {
    organization: string | null;
    country: string | null;
    street1: string | null;
    street2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    cellPhone: string | null;
    homePhone: string | null;
    email: string | null;
  } | null;
};

type SearchRow = { id: string; username: string; firstName: string | null; lastName: string | null };

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

export function ParcelAddCustomerSection({
  customer,
  setCustomer,
  resolvedUserId,
  onResolved,
}: {
  customer: QuickCustomerFormState;
  setCustomer: <K extends keyof QuickCustomerFormState>(key: K, value: QuickCustomerFormState[K]) => void;
  /** Set once a real customer id exists — search result or a completed Save. Gates the
   *  parcels table below, same as legacy's `checkBtns()`. */
  resolvedUserId: string;
  onResolved: (userId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedQuery = query.trim();
  // A customer already resolved (or too short a query) never has anything to show — computed
  // rather than cleared from inside the effect below, so that effect only ever deals with the
  // one case it actually owns: firing the debounced search.
  const visibleResults = resolvedUserId || trimmedQuery.length < MIN_QUERY_LENGTH ? [] : results;

  useEffect(() => {
    if (resolvedUserId || trimmedQuery.length < MIN_QUERY_LENGTH) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      listUsers<SearchRow>({
        accountType: 'Customer',
        page: 1,
        perPage: 20,
        sort: 'lastName',
        dir: 'asc',
        search: trimmedQuery,
      })
        .then((data) => !cancelled && setResults(data.items))
        .catch(() => !cancelled && setResults([]));
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedQuery, resolvedUserId]);

  async function pickExisting(id: string) {
    const { user } = await getUser<CustomerRow>(id);
    const billing = user.billingAddress;
    setCustomer('userId', id);
    setCustomer('firstName', user.firstName ?? '');
    setCustomer('lastName', user.lastName ?? '');
    setCustomer('organization', user.organization ?? billing?.organization ?? '');
    setCustomer('email', billing?.email ?? '');
    setCustomer('country', billing?.country ?? 'GE');
    setCustomer('street1', billing?.street1 ?? '');
    setCustomer('street2', billing?.street2 ?? '');
    setCustomer('city', billing?.city ?? '');
    setCustomer('state', billing?.state ?? '');
    setCustomer('postalCode', billing?.postalCode ?? '');
    setCustomer('phone1', billing?.cellPhone ?? '');
    setCustomer('phone2', billing?.homePhone ?? '');
    setQuery('');
    setResults([]);
    onResolved(id);
  }

  function clear() {
    setQuery('');
    setResults([]);
    for (const [key, value] of Object.entries(blankQuickCustomer())) {
      setCustomer(key as keyof QuickCustomerFormState, value as never);
    }
    onResolved('');
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const { userId } = await saveQuickCustomer(quickCustomerToPayload(customer));
      setCustomer('userId', userId);
      onResolved(userId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={s.panel}>
      {error && <Alert variant="error">{error}</Alert>}

      <div className={s.row}>
        <div className={s.grid}>
          <Field label="Customer:" width="lg">
            <div className={s.searchWrap}>
              <Input
                value={query}
                placeholder="Search by name, username or email…"
                disabled={!!resolvedUserId}
                onChange={(e) => setQuery(e.target.value)}
              />
              {visibleResults.length > 0 && (
                <ul className={s.results}>
                  {visibleResults.map((row) => (
                    <li key={row.id}>
                      <Button type="button" variant="plain" onClick={() => pickExisting(row.id)}>
                        {customerLabel(row)}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Field>
          <Field label=" " width="sm">
            <Button type="button" variant="secondary" onClick={clear} disabled={!resolvedUserId && !customer.firstName}>
              Clear
            </Button>
          </Field>

          <Field label="Organization:" htmlFor="qc-org" width="lg">
            <Input
              id="qc-org"
              value={customer.organization}
              onChange={(e) => setCustomer('organization', e.target.value)}
            />
          </Field>
          <Field label="First Name:" htmlFor="qc-firstname">
            <Input
              id="qc-firstname"
              value={customer.firstName}
              onChange={(e) => setCustomer('firstName', e.target.value)}
            />
          </Field>
          <Field label="Last Name:" htmlFor="qc-lastname">
            <Input
              id="qc-lastname"
              value={customer.lastName}
              onChange={(e) => setCustomer('lastName', e.target.value)}
            />
          </Field>
          <Field label="Email:" htmlFor="qc-email">
            <Input id="qc-email" value={customer.email} onChange={(e) => setCustomer('email', e.target.value)} />
          </Field>
          <Field label="Country:" htmlFor="qc-country">
            <Input
              id="qc-country"
              value={customer.country}
              maxLength={2}
              onChange={(e) => setCustomer('country', e.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Address 1:" htmlFor="qc-street1" width="lg">
            <Input id="qc-street1" value={customer.street1} onChange={(e) => setCustomer('street1', e.target.value)} />
          </Field>
          <Field label="Address 2:" htmlFor="qc-street2" width="lg">
            <Input id="qc-street2" value={customer.street2} onChange={(e) => setCustomer('street2', e.target.value)} />
          </Field>
          <Field label="City:" htmlFor="qc-city">
            <Input id="qc-city" value={customer.city} onChange={(e) => setCustomer('city', e.target.value)} />
          </Field>
          {customer.country !== 'GE' && (
            <>
              <Field label="State:" htmlFor="qc-state">
                <Input id="qc-state" value={customer.state} onChange={(e) => setCustomer('state', e.target.value)} />
              </Field>
              <Field label="Zip Code:" htmlFor="qc-zip">
                <Input
                  id="qc-zip"
                  value={customer.postalCode}
                  onChange={(e) => setCustomer('postalCode', e.target.value)}
                />
              </Field>
            </>
          )}
          <Field label="Cell phone:" htmlFor="qc-phone1">
            <Input id="qc-phone1" value={customer.phone1} onChange={(e) => setCustomer('phone1', e.target.value)} />
          </Field>
          <Field label="Phone:" htmlFor="qc-phone2">
            <Input id="qc-phone2" value={customer.phone2} onChange={(e) => setCustomer('phone2', e.target.value)} />
          </Field>
        </div>

        <div className={s.actions}>
          <Button type="button" className={s.save} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : resolvedUserId ? 'Update' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
