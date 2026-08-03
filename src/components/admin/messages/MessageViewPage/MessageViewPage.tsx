'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeading } from '@/components/ui/admin/PageHeading';
import { Textarea } from '@/components/ui/admin/Textarea';
import { Button } from '@/components/ui/admin/Button';
import { ErrorList } from '@/components/ui/admin/Alert';
import { TableSurface } from '@/components/ui/admin/Table';
import { routes } from '@/lib/routes';
import { getMessage, replyToMessage, type MessageDetail } from '@/lib/api/bema/messages';
import { ApiError, extractErrorMessages } from '@/lib/api/http';
import s from './MessageViewPage.module.css';

// bema "View message" (legacy `message_view.cfm`) — see docs/decisions/0033-bema-send-message.md.
// Legacy renders `messageFormatted`/`gemessageFormatted` via `HTMLCodeFormat()` — the markup
// shown as literal, escaped text (so an operator can see exactly what was sent, tags and all),
// not re-rendered as HTML. Reproduced the same way: plain text nodes, not
// `dangerouslySetInnerHTML` (unlike the compose form's own live *preview*, which legacy does
// render as HTML via jQuery's `.html()` — a real, deliberate asymmetry between the two
// screens, not an inconsistency to "fix").
export function MessageViewPage({ id }: { id: number }) {
  const router = useRouter();
  const [message, setMessage] = useState<MessageDetail | null>(null);
  const [replyMessage, setReplyMessage] = useState<{ bodyFormatted: string | null; bodyFormattedGe: string | null } | null>(
    null,
  );
  const [reply, setReply] = useState('');
  const [gereply, setGereply] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMessage(id)
      .then((data) => {
        if (cancelled) return;
        setMessage(data.message);
        setReplyMessage(data.replyMessage);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load message.');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    setSubmitting(true);
    try {
      const { id: newId } = await replyToMessage(id, { reply, gereply });
      router.push(routes.bema.messageView(newId));
    } catch (err) {
      setErrors(err instanceof ApiError ? extractErrorMessages(err.body) : ['Failed to send reply.']);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) return <ErrorList errors={[loadError]} />;
  if (!message) return <div>Loading…</div>;

  return (
    <div>
      <PageHeading>{`View message #${message.id}`}</PageHeading>

      <TableSurface scrollable={false}>
        <tbody>
          <tr>
            <td>
              <b>From</b>
            </td>
            <td>{message.senderUsername}</td>
          </tr>
          <tr>
            <td>
              <b>To</b>
            </td>
            <td>{message.username}</td>
          </tr>
          <tr>
            <td>
              <b>Date</b>
            </td>
            <td>{new Date(message.createdAt).toLocaleString()}</td>
          </tr>
          <tr>
            <td>
              <b>Subject</b>
            </td>
            <td>{message.subject}</td>
          </tr>
          <tr>
            <td>
              <b>Parcel tracking number</b>
            </td>
            <td>{message.trackingNum}</td>
          </tr>
          {replyMessage && (
            <tr>
              <td colSpan={2}>
                <b>Reply to body (English / Georgian):</b>
                <div className={s.dualBody}>
                  <pre className={s.body}>{replyMessage.bodyFormatted}</pre>
                  <pre className={s.body}>{replyMessage.bodyFormattedGe}</pre>
                </div>
              </td>
            </tr>
          )}
          <tr>
            <td colSpan={2}>
              <b>Body (English / Georgian):</b>
              <div className={s.dualBody}>
                <pre className={s.body}>{message.bodyFormatted}</pre>
                <pre className={s.body}>{message.bodyFormattedGe}</pre>
              </div>
            </td>
          </tr>
        </tbody>
      </TableSurface>

      <form className={s.replyForm} onSubmit={handleReply}>
        <ErrorList errors={errors} />
        <h3>Reply (English / Georgian)</h3>
        <div className={s.dualBody}>
          <Textarea rows={10} value={reply} onChange={(e) => setReply(e.target.value)} />
          <Textarea rows={10} value={gereply} onChange={(e) => setGereply(e.target.value)} />
        </div>
        <div className={s.actions}>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Submit Reply'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.push(routes.bema.messages())}>
            Back to Messages
          </Button>
        </div>
      </form>
    </div>
  );
}
