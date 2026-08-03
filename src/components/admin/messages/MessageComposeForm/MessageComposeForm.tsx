'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CustomerPicker } from '@/components/ui/admin/CustomerPicker';
import { Field } from '@/components/ui/admin/Field';
import { Input } from '@/components/ui/admin/Input';
import { Select } from '@/components/ui/admin/Select';
import { Textarea } from '@/components/ui/admin/Textarea';
import { Button } from '@/components/ui/admin/Button';
import { ErrorList } from '@/components/ui/admin/Alert';
import { routes } from '@/lib/routes';
import { getUser, listMessageTypes } from '@/lib/api/bema/users';
import { lookupOnlineParcel } from '@/lib/api/bema/parcels';
import { composeMessage, getMessageTemplate } from '@/lib/api/bema/messages';
import { ApiError, extractErrorMessages } from '@/lib/api/http';
import s from './MessageComposeForm.module.css';

type MessageTypeOption = { key: string; label: string; labelGe: string | null };
type CustomerRow = { firstName: string | null };

const FIELD_LABELS: Record<string, string> = {
  userId: 'Customer',
  messageTypeKey: 'Message type',
};

/** Legacy `DateDiff('d', a, b)`. */
function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Legacy `{service}` token: `"#service# service"` when non-blank, else `""`. */
function serviceToken(service: string): string {
  return service ? `${service} service` : '';
}

/** Mirrors `messages-add.js`'s `previewTemplate()` — client-side only, for live preview; the
 *  authoritative substitution happens server-side in `composeMessage()` on submit. */
function preview(template: string, tokens: Record<string, string>, message: string): string {
  let result = `${template}<p>{message}</p>`;
  for (const [key, value] of Object.entries({ ...tokens, message })) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

// bema "Send message" (legacy `bema/messages/message_add.cfm`) — see
// docs/decisions/0033-bema-send-message.md.
export function MessageComposeForm() {
  const router = useRouter();

  const [messageTypes, setMessageTypes] = useState<MessageTypeOption[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [customerLabel, setCustomerLabel] = useState('');
  const [customerLocked, setCustomerLocked] = useState(false);
  const [firstname, setFirstname] = useState('');

  const [trackingnum, setTrackingnum] = useState('');
  const [trackingnum2, setTrackingnum2] = useState('');
  const [parcelId, setParcelId] = useState('');
  const [matchedSummary, setMatchedSummary] = useState('');
  const [rname, setRname] = useState('');
  const [rcity, setRcity] = useState('');
  const [receiverid, setReceiverid] = useState('');
  const [service, setService] = useState('');
  const [senddate, setSenddate] = useState('');
  const [deliverydate, setDeliverydate] = useState('');
  const [servicetransit, setServicetransit] = useState('');
  const [missinginfo, setMissinginfo] = useState('');

  const [messageTypeKey, setMessageTypeKey] = useState('');
  const [template, setTemplate] = useState({ en: '', ge: '' });
  const [subject, setSubject] = useState('');
  const [subjectGe, setSubjectGe] = useState('');
  const [message, setMessage] = useState('');
  const [gemessage, setGemessage] = useState('');

  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listMessageTypes()
      .then((data) => setMessageTypes(data.messageTypes))
      .catch(() => setMessageTypes([]));
  }, []);

  async function selectCustomer(id: string, label: string) {
    setCustomerId(id);
    setCustomerLabel(label);
    const { user } = await getUser<CustomerRow>(id);
    setFirstname(user.firstName ?? '');
  }

  async function handleTrackingLookup() {
    if (!trackingnum.trim()) return;
    const { parcel } = await lookupOnlineParcel(trackingnum.trim(), { withTrackingNum2: false });
    if (!parcel) {
      setErrors(['Tracking number not found']);
      return;
    }
    setErrors([]);
    setParcelId(parcel.parcelId);
    setService(parcel.service ?? '');
    setSenddate(parcel.tripDate ? new Date(parcel.tripDate).toLocaleDateString('en-US') : '');
    setReceiverid(parcel.receiverId ?? '');
    setDeliverydate(parcel.trackingEstDelivery ? new Date(parcel.trackingEstDelivery).toLocaleDateString('en-US') : '');
    setRname(`${parcel.receiverFirstName} ${parcel.receiverLastName}`.trim());
    setRcity('');
    setMatchedSummary(`Matched parcel ${parcel.trackingNum} — receiver: ${parcel.receiverFirstName} ${parcel.receiverLastName}`.trim());

    if (parcel.trackingEstShip && parcel.trackingEstDelivery) {
      setServicetransit(String(diffDays(new Date(parcel.trackingEstShip), new Date(parcel.trackingEstDelivery))));
    } else if (parcel.trackingEstDelivery && parcel.tripDate) {
      setServicetransit(String(diffDays(new Date(parcel.tripDate), new Date(parcel.trackingEstDelivery))));
    } else {
      setServicetransit('');
    }

    const missing: string[] = [];
    if (!parcel.contents) missing.push('parcel content');
    if (!parcel.value) missing.push('value');
    if (!parcel.receiverId) missing.push('receiver info');
    setMissinginfo(missing.join(', '));

    // Legacy: a successful tracking lookup re-syncs the customer to the parcel's own owner,
    // not whoever might already be picked in the Customer field.
    await selectCustomer(parcel.userId, parcel.longName);
    setCustomerLocked(true);
  }

  function handleMessageTypeChange(key: string) {
    setMessageTypeKey(key);
    const type = messageTypes.find((t) => t.key === key);
    setSubject(type?.label ?? '');
    setSubjectGe(type?.labelGe ?? type?.label ?? '');
    getMessageTemplate(key)
      .then(setTemplate)
      .catch(() => setTemplate({ en: '', ge: '' }));
  }

  const tokens = {
    trackingnum: trackingnum2 ? (trackingnum ? `${trackingnum}, ${trackingnum2}` : trackingnum2) : trackingnum,
    firstname,
    rname,
    rcity,
    receiverid,
    senddate,
    deliverydate,
    servicetransit,
    missinginfo,
    service: serviceToken(service),
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    setSubmitting(true);
    try {
      const { id } = await composeMessage({
        userId: customerId,
        parcelId: parcelId || null,
        messageTypeKey,
        subject,
        subjectGe,
        message,
        gemessage,
        trackingnum,
        trackingnum2,
        today: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        firstname,
        rname,
        rcity,
        receiverid,
        senddate,
        deliverydate,
        servicetransit,
        missinginfo,
        service,
      });
      router.push(routes.bema.messageView(id));
    } catch (err) {
      setErrors(err instanceof ApiError ? extractErrorMessages(err.body, FIELD_LABELS) : ['Send failed.']);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  }

  const typeOptions = messageTypes.map((t) => ({ value: t.key, label: t.label }));

  return (
    <form className={s.form} onSubmit={handleSubmit}>
      <ErrorList errors={errors} />

      <Field label="Customer user name*" htmlFor="customer" width="lg">
        <CustomerPicker
          value={customerId}
          label={customerLabel}
          onChange={(c) => {
            selectCustomer(c.id, c.label);
            setCustomerLocked(false);
          }}
          onClear={
            customerLocked
              ? undefined
              : () => {
                  setCustomerId('');
                  setCustomerLabel('');
                  setFirstname('');
                }
          }
        />
      </Field>

      <div className={s.row}>
        <Field label="Tracking number" htmlFor="trackingnum" width="md">
          <Input
            id="trackingnum"
            value={trackingnum}
            onChange={(e) => setTrackingnum(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleTrackingLookup();
              }
            }}
            placeholder="Fill number and press Enter"
          />
        </Field>
        <Field label="Additional tracking number" htmlFor="trackingnum2" width="md">
          <Input id="trackingnum2" value={trackingnum2} onChange={(e) => setTrackingnum2(e.target.value)} />
        </Field>
      </div>
      {matchedSummary && <p className={s.matched}>{matchedSummary}</p>}

      <Field label="Message type*" htmlFor="messagetype" width="md">
        <Select
          instanceId="message-compose-type"
          options={typeOptions}
          value={messageTypeKey}
          onChange={handleMessageTypeChange}
          placeholder="Select message type"
        />
      </Field>

      <div className={s.row}>
        <Field label="Subject (English)" htmlFor="subject" width="lg">
          <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field label="Subject (Georgian)" htmlFor="subjectGe" width="lg">
          <Input id="subjectGe" value={subjectGe} onChange={(e) => setSubjectGe(e.target.value)} />
        </Field>
      </div>

      <div className={s.row}>
        <div className={s.column}>
          <Field label="Message (English)" htmlFor="message" width="lg">
            <Textarea id="message" rows={10} value={message} onChange={(e) => setMessage(e.target.value)} />
          </Field>
          <div className={s.previewBox}>
            <h3>Preview (English)</h3>
            <div dangerouslySetInnerHTML={{ __html: preview(template.en, tokens, message) }} />
          </div>
        </div>
        <div className={s.column}>
          <Field label="Message (Georgian)" htmlFor="gemessage" width="lg">
            <Textarea id="gemessage" rows={10} value={gemessage} onChange={(e) => setGemessage(e.target.value)} />
          </Field>
          <div className={s.previewBox}>
            <h3>Preview (Georgian)</h3>
            <div dangerouslySetInnerHTML={{ __html: preview(template.ge, tokens, gemessage) }} />
          </div>
        </div>
      </div>

      <div className={s.actions}>
        <Button type="submit" disabled={submitting || !customerId || !messageTypeKey}>
          {submitting ? 'Sending…' : 'Send'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push(routes.bema.messages())}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
