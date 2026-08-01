'use client';

import { useEffect, useState } from 'react';
import { PageHeading } from '@/components/ui/admin/PageHeading';
import { Field } from '@/components/ui/admin/Field';
import { Select } from '@/components/ui/admin/Select';
import { Checkbox } from '@/components/ui/admin/Checkbox';
import { Textarea } from '@/components/ui/admin/Textarea';
import { Button } from '@/components/ui/admin/Button';
import { ErrorList, Alert } from '@/components/ui/admin/Alert';
import { TableSurface } from '@/components/ui/admin/Table';
import {
  cleanSmsQueue,
  getSmsQueuePreview,
  sendBulkSms,
  type SmsQueueEntryDTO,
  type SmsQueuePreview,
} from '@/lib/api/bema/messages';
import { ApiError, extractErrorMessages } from '@/lib/api/http';
import s from './SmsBulkPage.module.css';

// bema "Send Bulk SMS" (legacy `bema/messages/sms_add_bulk.cfm` + `vwSmsAddBulk.cfm` +
// `sms-add-bulk.js`) — see docs/decisions/0025-bema-send-bulk-sms.md.

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'OnHold', label: 'OnHold' },
  { value: 'NotOnHold', label: 'Removed from OnHold' },
  { value: 'office', label: 'Received in Tbilisi office' },
  { value: 'custom', label: 'Process Custom Clearance' },
  { value: 'outdelivery', label: 'Out of Delivery' },
  { value: 'Delay', label: 'Delay' },
  { value: 'received', label: 'Received in USA' },
  { value: 'awaiting', label: 'Awaiting' },
  { value: 'region', label: 'Send to Region' },
  { value: 'shipped', label: 'Shipped' },
  // Legacy's own dropdown still offers this even though the underlying status computation
  // never produces a "paid" value — kept for UI parity, always yields zero candidates. See
  // docs/findings.md.
  { value: 'paid', label: 'Paid' },
];

const COUNTRY_OPTIONS: { value: 'GE' | 'US' | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'GE', label: 'Georgia' },
  { value: 'US', label: 'United States' },
];

function QueueRow({ entry }: { entry: SmsQueueEntryDTO }) {
  return (
    <tr>
      <td>{entry.phone}</td>
      <td>{entry.text}</td>
      <td>{new Date(entry.createdAt).toLocaleString()}</td>
      <td>{entry.phoneType}</td>
    </tr>
  );
}

export function SmsBulkPage() {
  const [status, setStatus] = useState('');
  const [country, setCountry] = useState<'GE' | 'US' | ''>('');
  const [sendToCustomer, setSendToCustomer] = useState(true);
  const [sendToReceiver, setSendToReceiver] = useState(true);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [preview, setPreview] = useState<SmsQueuePreview | null>(null);

  function refreshPreview() {
    getSmsQueuePreview()
      .then(setPreview)
      .catch(() => setPreview(null));
  }

  useEffect(() => {
    refreshPreview();
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    // Legacy's own submit handler (`sms-add-bulk.js`) blocks the POST behind this exact
    // confirmation dialog.
    if (!window.confirm('Are you sure you want to send messages to users according to the selected filters?')) {
      return;
    }
    setErrors([]);
    setSaved(null);

    const sendTo: ('customer' | 'receiver')[] = [
      ...(sendToReceiver ? (['receiver'] as const) : []),
      ...(sendToCustomer ? (['customer'] as const) : []),
    ];

    setSubmitting(true);
    try {
      const { found, inserted } = await sendBulkSms({ status, country, sendTo, message });
      const addMessage = found !== inserted ? ` (${found - inserted} already in queue)` : '';
      setSaved(`Found numbers: ${found}. Inserted to queue ${inserted}${addMessage}`);
      // Legacy redirects to a fresh GET of this same screen on success, which resets every
      // field to its default — reproduced by resetting local state the same way.
      setStatus('');
      setCountry('');
      setSendToCustomer(true);
      setSendToReceiver(true);
      setMessage('');
      refreshPreview();
    } catch (err) {
      setErrors(err instanceof ApiError ? extractErrorMessages(err.body) : ['Save failed.']);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClean(e: React.FormEvent) {
    e.preventDefault();
    if (!window.confirm('Are you sure you want to delete all messages from the queue?')) return;
    setErrors([]);
    setSaved(null);
    setClearing(true);
    try {
      await cleanSmsQueue();
      setSaved('The queue has been cleared');
      refreshPreview();
    } catch (err) {
      setErrors(err instanceof ApiError ? extractErrorMessages(err.body) : ['Save failed.']);
    } finally {
      setClearing(false);
    }
  }

  return (
    <div>
      <PageHeading>Send sms</PageHeading>
      <ErrorList errors={errors} />
      {saved && <Alert variant="success">{saved}</Alert>}

      <form className={s.row} onSubmit={handleSend}>
        <Field label="Status:" htmlFor="status">
          <Select instanceId="bulk-sms-status" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
        </Field>
        <Field label="Customer Country:" htmlFor="country">
          <Select
            instanceId="bulk-sms-country"
            options={COUNTRY_OPTIONS}
            value={country}
            onChange={(v) => setCountry(v as 'GE' | 'US' | '')}
          />
        </Field>
        <Field label="Send to:">
          <div className={s.checkboxes}>
            <Checkbox
              label="receiver"
              checked={sendToReceiver}
              onChange={(e) => setSendToReceiver(e.target.checked)}
            />
            <Checkbox
              label="customer"
              checked={sendToCustomer}
              onChange={(e) => setSendToCustomer(e.target.checked)}
            />
          </div>
        </Field>
        <Field label="Message:" htmlFor="message">
          <Textarea id="message" rows={10} required value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send'}
        </Button>
      </form>

      <h2>Queue info</h2>
      <p>Messages in queue: {preview?.count ?? 0}</p>

      {preview && preview.queue.length > 0 && (
        <>
          <h3>Last and first messages in queue</h3>
          <TableSurface className={s.table}>
            <thead>
              <tr>
                <th>Phone</th>
                <th>Text</th>
                <th>Created At</th>
                <th>Phone Country</th>
              </tr>
            </thead>
            <tbody>
              {preview.queue.map((entry) => (
                <QueueRow key={entry.id} entry={entry} />
              ))}
              {preview.queueFirst && (
                <>
                  <tr>
                    <td colSpan={4} className={s.separator}>
                      .........
                    </td>
                  </tr>
                  {preview.queueFirst.map((entry) => (
                    <QueueRow key={entry.id} entry={entry} />
                  ))}
                </>
              )}
            </tbody>
          </TableSurface>
        </>
      )}

      <form onSubmit={handleClean}>
        <Button type="submit" disabled={clearing}>
          Empty queue
        </Button>
      </form>
    </div>
  );
}
