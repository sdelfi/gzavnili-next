'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field } from '@/components/ui/admin/Field';
import { Input } from '@/components/ui/admin/Input';
import { Textarea } from '@/components/ui/admin/Textarea';
import { Button } from '@/components/ui/admin/Button';
import { ErrorList } from '@/components/ui/admin/Alert';
import { routes } from '@/lib/routes';
import { updateEmailTemplate, type EmailTemplate } from '@/lib/api/bema/emails';
import { ApiError, extractErrorMessages } from '@/lib/api/http';
import s from './EmailTemplateEditForm.module.css';

export type EmailTemplateEditFormValues = {
  sender: string;
  recipients: string;
  subject: string;
  message: string;
};

const FIELD_LABELS: Record<string, string> = {
  subject: 'Subject',
  sender: 'Sender',
};

// bema "Edit Email" (legacy `bema/config/email_edit.cfm` + `views/config/vwEmailEditForm.cfm`)
// — see docs/decisions/0031-system-emails.md.
export function EmailTemplateEditForm({
  template,
  globalSender,
  globalRecipients,
}: {
  template: EmailTemplate;
  /** The "Basic Configuration" sender/recipients this template falls back to when its own
   *  fields are blank — shown as a hint, matching legacy's `vwEmailEditForm.cfm`. */
  globalSender: string;
  globalRecipients: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<EmailTemplateEditFormValues>({
    sender: template.sender ?? '',
    recipients: template.recipients ?? '',
    subject: template.subject ?? '',
    message: template.message ?? '',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof EmailTemplateEditFormValues>(key: K, value: EmailTemplateEditFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    setSubmitting(true);
    try {
      await updateEmailTemplate(template.id, values);
      router.push(routes.bema.systemEmails());
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

      <p className={s.header}>
        <b>{template.id}</b>
        {template.description ? ` : ${template.description}` : null}
      </p>

      <Field
        label="Sender"
        htmlFor="sender"
        width="lg"
        hint={`(if blank, will send to: ${globalSender})`}
      >
        <Input id="sender" maxLength={75} value={values.sender} onChange={(e) => set('sender', e.target.value)} />
      </Field>

      <Field
        label="Recipients"
        htmlFor="recipients"
        width="lg"
        hint={
          template.recipientOverwrite
            ? `(comma separated list) (if blank, will send to: ${globalRecipients})`
            : '(comma separated list) (will also send to customer)'
        }
      >
        <Input
          id="recipients"
          maxLength={255}
          value={values.recipients}
          onChange={(e) => set('recipients', e.target.value)}
        />
      </Field>

      <Field label="Subject" htmlFor="subject" width="lg">
        <Input id="subject" maxLength={100} value={values.subject} onChange={(e) => set('subject', e.target.value)} />
      </Field>

      <Field label="Message" htmlFor="message" width="lg">
        <Textarea id="message" rows={16} value={values.message} onChange={(e) => set('message', e.target.value)} />
      </Field>

      {template.tags && <p className={s.tags}>Usable Tags: {template.tags}</p>}

      <div className={s.actions}>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push(routes.bema.systemEmails())}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
