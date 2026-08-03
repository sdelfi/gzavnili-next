'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeading } from '@/components/ui/admin/PageHeading';
import { CollapsibleSection } from '@/components/ui/admin/CollapsibleSection';
import { Field } from '@/components/ui/admin/Field';
import { Input } from '@/components/ui/admin/Input';
import { Textarea } from '@/components/ui/admin/Textarea';
import { Button } from '@/components/ui/admin/Button';
import { ErrorList } from '@/components/ui/admin/Alert';
import { Table, type Column } from '@/components/ui/admin/Table';
import { routes } from '@/lib/routes';
import {
  getSystemEmailConfig,
  updateSystemEmailConfig,
  listEmailTemplates,
  type SystemEmailConfig,
  type EmailTemplateSummary,
} from '@/lib/api/bema/emails';
import { ApiError, extractErrorMessages } from '@/lib/api/http';
import s from './SystemEmailsPage.module.css';

const FIELD_LABELS: Record<string, string> = {
  emailSender: 'System Email Sender',
  emailRecipients: 'System Email Recipients',
};

// bema "System Emails" (legacy `bema/config/emails.cfm` + `views/config/vwSystemEmailForm.cfm`)
// — "Basic Configuration" (sender/recipients/header/footer, a singleton `config` row) plus the
// "Specific Emails" list of the 10 fixed per-template rows, each linking to its own edit
// screen. See docs/decisions/0031-system-emails.md.
export function SystemEmailsPage() {
  const [config, setConfig] = useState<SystemEmailConfig | null>(null);
  const [templates, setTemplates] = useState<EmailTemplateSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([getSystemEmailConfig(), listEmailTemplates()])
      .then(([configData, templatesData]) => {
        setConfig(configData.config);
        setTemplates(templatesData.templates);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load System Emails.'));
  }, []);

  function set<K extends keyof SystemEmailConfig>(key: K, value: SystemEmailConfig[K]) {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    setErrors([]);
    setSubmitting(true);
    try {
      const data = await updateSystemEmailConfig(config);
      setConfig(data.config);
      setSaved(true);
    } catch (err) {
      setErrors(err instanceof ApiError ? extractErrorMessages(err.body, FIELD_LABELS) : ['Save failed.']);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  }

  const columns: Column<EmailTemplateSummary>[] = [
    { key: 'id', label: 'Email Name' },
    { key: 'description', label: 'Description' },
    {
      key: 'actions',
      label: '',
      render: (t) => (
        <Link href={routes.bema.systemEmailEdit(t.id)} className={s.editLink}>
          Edit
        </Link>
      ),
    },
  ];

  if (loadError) return <ErrorList errors={[loadError]} />;

  return (
    <div>
      <PageHeading>System Emails</PageHeading>

      <CollapsibleSection title="Basic Configuration">
        {!config ? (
          <div>Loading…</div>
        ) : (
          <form className={s.form} onSubmit={handleSubmit}>
            <ErrorList errors={errors} />
            {saved && <p className={s.saved}>Saved.</p>}

            <Field label="System Email Sender" htmlFor="emailSender" width="lg">
              <Input
                id="emailSender"
                type="email"
                value={config.emailSender}
                onChange={(e) => set('emailSender', e.target.value)}
              />
            </Field>
            <Field label="System Email Recipients" htmlFor="emailRecipients" width="lg">
              <Input
                id="emailRecipients"
                value={config.emailRecipients}
                onChange={(e) => set('emailRecipients', e.target.value)}
                placeholder="comma-separated addresses"
              />
            </Field>
            <Field label="Email Header" htmlFor="emailHeader" width="lg">
              <Textarea
                id="emailHeader"
                rows={6}
                value={config.emailHeader}
                onChange={(e) => set('emailHeader', e.target.value)}
              />
            </Field>
            <Field label="Email Footer" htmlFor="emailFooter" width="lg">
              <Textarea
                id="emailFooter"
                rows={6}
                value={config.emailFooter}
                onChange={(e) => set('emailFooter', e.target.value)}
              />
            </Field>

            <div className={s.actions}>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </form>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Specific Emails">
        <Table
          columns={columns}
          rows={templates}
          getRowKey={(t) => t.id}
          emptyMessage={loadError ? '' : 'Loading…'}
        />
      </CollapsibleSection>
    </div>
  );
}
