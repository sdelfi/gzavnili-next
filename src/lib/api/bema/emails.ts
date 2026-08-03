import { apiGet, apiPatch } from '../http';

// Bema "System Emails" (legacy `bema/config/emails.cfm` + `email_edit.cfm`) — see
// docs/decisions/0031-system-emails.md.

export type SystemEmailConfig = {
  emailSender: string;
  emailRecipients: string;
  emailHeader: string;
  emailFooter: string;
};

export function getSystemEmailConfig() {
  return apiGet<{ config: SystemEmailConfig }>('/api/bema/config/emails');
}

export function updateSystemEmailConfig(payload: SystemEmailConfig) {
  return apiPatch<{ config: SystemEmailConfig }>('/api/bema/config/emails', payload);
}

export type EmailTemplateSummary = {
  id: string;
  description: string | null;
};

export function listEmailTemplates() {
  return apiGet<{ templates: EmailTemplateSummary[] }>('/api/bema/config/emails/templates');
}

export type EmailTemplate = {
  id: string;
  subject: string | null;
  message: string | null;
  sender: string | null;
  recipients: string | null;
  description: string | null;
  tags: string | null;
  recipientOverwrite: boolean;
};

export function getEmailTemplate(id: string) {
  return apiGet<{ template: EmailTemplate }>(`/api/bema/config/emails/templates/${encodeURIComponent(id)}`);
}

export type EmailTemplateEditPayload = {
  subject: string;
  sender: string;
  recipients: string;
  message: string;
};

export function updateEmailTemplate(id: string, payload: EmailTemplateEditPayload) {
  return apiPatch<{ template: EmailTemplate }>(
    `/api/bema/config/emails/templates/${encodeURIComponent(id)}`,
    payload,
  );
}
