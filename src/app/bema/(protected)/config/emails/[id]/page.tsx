'use client';

import { Suspense, use, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/admin/Alert';
import { PageHeading } from '@/components/ui/admin/PageHeading';
import { EmailTemplateEditForm } from '@/components/admin/EmailTemplateEditForm';
import { getEmailTemplate, getSystemEmailConfig, type EmailTemplate } from '@/lib/api/bema/emails';

function EditEmailTemplateInner({ params }: { params: Promise<{ id: string }> }) {
  // Some `EmailId`s contain spaces (e.g. "Account Change") — `decodeURIComponent` here is a
  // safe no-op if the framework already decoded the segment, and the fix if it didn't.
  const { id: rawId } = use(params);
  const id = decodeURIComponent(rawId);
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [globalSender, setGlobalSender] = useState('');
  const [globalRecipients, setGlobalRecipients] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getEmailTemplate(id), getSystemEmailConfig()])
      .then(([templateData, configData]) => {
        setTemplate(templateData.template);
        setGlobalSender(configData.config.emailSender);
        setGlobalRecipients(configData.config.emailRecipients);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load email template.'));
  }, [id]);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!template) return <div>Loading…</div>;

  return (
    <div>
      <PageHeading>Edit Email</PageHeading>
      <EmailTemplateEditForm template={template} globalSender={globalSender} globalRecipients={globalRecipients} />
    </div>
  );
}

export default function EditBemaEmailTemplatePage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <EditEmailTemplateInner {...props} />
    </Suspense>
  );
}
