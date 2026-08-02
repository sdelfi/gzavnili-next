'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import cn from 'classnames';
import { PageHeading } from '@/components/ui/admin/PageHeading';
import { Field } from '@/components/ui/admin/Field';
import { Input } from '@/components/ui/admin/Input';
import { Button } from '@/components/ui/admin/Button';
import { Alert, ErrorList } from '@/components/ui/admin/Alert';
import { lookupOnlineParcel, resolveParcelOnholdCheck } from '@/lib/api/bema/parcels';
import { ApiError, extractErrorMessages } from '@/lib/api/http';
import { routes } from '@/lib/routes';
import s from './ParcelCheckOnholdPage.module.css';

// bema "Check on hold" (`bema/parcels/parcels-check-onhold.cfm` +
// `views/parcels/vwParcelsCheckOnhold.cfm` + `include/js/parcels-check-onhold.js`) — see
// docs/decisions/0028-parcels-check-onhold.md. Staff scans an on-hold parcel's tracking
// number; the screen shows its service and, based on whether store/value/contents are on
// file, either a "Still on hold" or "Remove from on hold" button.

type ButtonMode = 'none' | 'still' | 'remove';

export function ParcelCheckOnholdPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [trackingNum, setTrackingNum] = useState('');
  const [looking, setLooking] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [service, setService] = useState('');
  const [parcelId, setParcelId] = useState<string | null>(null);
  const [buttonMode, setButtonMode] = useState<ButtonMode>('none');
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function runLookup(value: string) {
    setErrors([]);
    setSaved(null);
    setNotFound(false);
    setService('');
    setParcelId(null);
    setButtonMode('none');
    if (!value.trim()) return;

    setLooking(true);
    try {
      // Legacy's own `getParcel.cfm?cut=1&trackingnum=...` — no `cutlength` (so its default
      // of 11 applies) and no `withtrackingnum2` (so it defaults off).
      const { parcel } = await lookupOnlineParcel(value, { cutLength: 11, withTrackingNum2: false });
      if (!parcel) {
        setNotFound(true);
        return;
      }
      if (!parcel.weight) {
        // Legacy redirects to `parcels-online-add.cfm?trackingnum=...` — the old, already
        // de-linked variant of this screen (commented out of legacy's own nav in favor of
        // `-2.cfm`). Redirecting to the live ported equivalent instead; see docs/findings.md.
        router.push(`${routes.bema.parcelOnlineAdd()}?trackingnum=${encodeURIComponent(value)}`);
        return;
      }

      setParcelId(parcel.parcelId);
      setService(parcel.service ?? '');
      // Legacy's own client-side hint (`data.STORE == '' || data.VALUE == '' ||
      // data.VALUE < 1 || data.CONTENTS == ''`) — which button to show. Deliberately not the
      // same threshold the server uses to decide what actually happens on submit
      // (`resolveParcelOnholdCheck`, `value === 0` not `< 1`) — a real legacy inconsistency,
      // reproduced as two separate checks. See docs/findings.md.
      const stillOnHoldHint =
        !parcel.store || !parcel.value || parseFloat(parcel.value) < 1 || !parcel.contents;
      setButtonMode(stillOnHoldHint ? 'still' : 'remove');
    } catch (err) {
      setErrors(err instanceof ApiError ? extractErrorMessages(err.body) : ['Lookup failed.']);
    } finally {
      setLooking(false);
    }
  }

  async function handleResolve() {
    if (!parcelId) return;
    setErrors([]);
    setSubmitting(true);
    try {
      const { message } = await resolveParcelOnholdCheck(parcelId);
      setSaved(message);
      setTrackingNum('');
      setService('');
      setParcelId(null);
      setButtonMode('none');
      inputRef.current?.focus();
    } catch (err) {
      setErrors(err instanceof ApiError ? extractErrorMessages(err.body) : ['Save failed.']);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeading>Check on hold</PageHeading>
      <ErrorList errors={errors} />
      {saved && <Alert variant="success">{saved}</Alert>}

      <form
        className={s.row}
        onSubmit={(e) => {
          e.preventDefault();
          handleResolve();
        }}
      >
        <Field label="Tracking Number:" htmlFor="trackingnum">
          <Input
            ref={inputRef}
            id="trackingnum"
            autoFocus
            disabled={looking}
            value={trackingNum}
            onChange={(e) => setTrackingNum(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                runLookup(trackingNum);
              }
            }}
          />
        </Field>

        {notFound && <Alert variant="warning">Tracking number not found</Alert>}

        {service && (
          <div
            id="parcelService"
            className={cn(s.service, {
              [s.regular]: service.toLowerCase() === 'regular',
              [s.express]: service.toLowerCase() === 'express',
            })}
          >
            Service: <b>{service}</b>
          </div>
        )}

        {buttonMode === 'still' && (
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Still on hold'}
          </Button>
        )}
        {buttonMode === 'remove' && (
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Remove from on hold'}
          </Button>
        )}
      </form>
    </div>
  );
}
