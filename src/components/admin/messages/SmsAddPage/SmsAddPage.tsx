'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeading } from '@/components/ui/admin/PageHeading';
import { Field } from '@/components/ui/admin/Field';
import { Input } from '@/components/ui/admin/Input';
import { Textarea } from '@/components/ui/admin/Textarea';
import { Button } from '@/components/ui/admin/Button';
import { ErrorList, Alert } from '@/components/ui/admin/Alert';
import { lookupOnlineParcel } from '@/lib/api/bema/parcels';
import { getReceiver } from '@/lib/api/bema/receivers';
import { sendSms } from '@/lib/api/bema/messages';
import { ApiError, extractErrorMessages } from '@/lib/api/http';
import s from './SmsAddPage.module.css';

// bema "Send SMS" (legacy `bema/messages/sms_add.cfm` + `views/messages/vwSmsAdd.cfm` +
// `include/js/sms-add.js`) — see docs/decisions/0024-bema-send-sms.md.

type RawReceiver = { address: { firstName: string; lastName: string; phone1: string } };

export function SmsAddPage() {
  const searchParams = useSearchParams();
  const [trackingNum, setTrackingNum] = useState(() => searchParams.get('trackingnum') ?? '');
  const [locked, setLocked] = useState(false);
  const [name, setName] = useState('');
  const [phone1, setPhone1] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [looking, setLooking] = useState(false);

  async function runLookup(value: string) {
    if (!value.trim()) return;
    setErrors([]);
    setLooking(true);
    try {
      const { parcel } = await lookupOnlineParcel(value, { cut: 'exact' });
      // Legacy's own `response.DATA.RECEIVERID == ''` check fires identically whether the
      // tracking number wasn't found at all or matched a parcel with no receiver — its
      // "Tracking number not found" branch is dead code (`response.DATA` is always a truthy
      // object, so `!response.DATA` never happens), so both cases show this one message here
      // too. See docs/findings.md.
      if (!parcel || !parcel.receiverId) {
        window.alert('This tracking number do not have receiver');
        return;
      }
      const { receiver } = await getReceiver<RawReceiver>(parcel.receiverId);
      setName(`${receiver.address.lastName} ${receiver.address.firstName} / ${receiver.address.phone1}`.trim());
      setPhone1(receiver.address.phone1);
      setLocked(true);
    } catch (err) {
      setErrors(err instanceof ApiError ? extractErrorMessages(err.body) : ['Lookup failed.']);
    } finally {
      setLooking(false);
    }
  }

  useEffect(() => {
    // Only the initial (possibly url-supplied) tracking number auto-runs, matching legacy's
    // own "if trackingnum is prefilled on load, look it up immediately" behavior. Deferred a
    // tick so the lookup's own setState calls don't run synchronously within the effect body.
    if (trackingNum.trim()) Promise.resolve().then(() => runLookup(trackingNum));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    setSaved(null);
    // Mirrors legacy's own gate: the receiver-name field is the only `required` input on this
    // form, and — since unlocking the tracking number field for editing does *not* clear it —
    // submission is gated on `name` actually holding a value, not on `locked`.
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      const { id } = await sendSms({ phone1, message });
      setSaved(`SMS #${id} successfully sent`);
      setTrackingNum('');
      setLocked(false);
      setName('');
      setPhone1('');
      setMessage('');
    } catch (err) {
      setErrors(err instanceof ApiError ? extractErrorMessages(err.body) : ['Send failed.']);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeading>Send sms</PageHeading>
      <ErrorList errors={errors} />
      {saved && <Alert variant="success">{saved}</Alert>}

      <form className={s.row} onSubmit={handleSubmit}>
        <Field label="Receiver info*:" htmlFor="name">
          <Input id="name" value={name} readOnly placeholder="Fill tracking number below" />
        </Field>
        <Field label="Tracking number:" htmlFor="trackingnum">
          <div className={s.trackingWrap}>
            <Input
              id="trackingnum"
              value={trackingNum}
              readOnly={locked}
              disabled={looking}
              placeholder="Fill number and press Enter"
              onChange={(e) => setTrackingNum(e.target.value)}
              onClick={() => {
                if (locked) setLocked(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  runLookup(trackingNum);
                }
              }}
            />
            {locked && <span className={s.clearX}>x</span>}
          </div>
        </Field>
        <Field label="Message:" htmlFor="message">
          <Textarea id="message" rows={10} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        <Button type="submit" disabled={submitting || !name.trim()}>
          {submitting ? 'Sending…' : 'Send'}
        </Button>
      </form>
    </div>
  );
}
