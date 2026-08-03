import { z } from 'zod';

// bema "System Emails" (`bema/config/emails.cfm`) — "Basic Configuration" section, ported
// from `EmailConfigFormValidation.cfc`. Sender is required and must be a valid email;
// recipients is a comma-separated list where each *non-blank* entry must be a valid email
// (blank entries, e.g. a trailing comma, are silently skipped — not an error); header/footer
// have no validation at all in legacy.
export const systemEmailConfigSchema = z.object({
  emailSender: z
    .string()
    .trim()
    .min(1, 'System Email Sender is required.')
    .refine((v) => z.string().email().safeParse(v).success, 'System Email Sender is invalid.'),
  emailRecipients: z.string().superRefine((value, ctx) => {
    const recipients = value.split(',');
    recipients.forEach((recipient, i) => {
      const trimmed = recipient.trim();
      if (trimmed.length > 0 && !z.string().email().safeParse(trimmed).success) {
        ctx.addIssue({ code: 'custom', message: `System Email Recipient #${i + 1} is invalid.` });
      }
    });
  }),
  emailHeader: z.string(),
  emailFooter: z.string(),
});

export type SystemEmailConfigInput = z.infer<typeof systemEmailConfigSchema>;

// Per-template edit (`bema/config/email_edit.cfm`) — ported from that controller's own inline
// POST validation (`email_edit.cfm` has no separate FormValidation component): Subject is
// required, max 100 chars; Sender is optional but must be a valid email if non-blank; Message
// and Recipients have no validation at all.
export const emailTemplateEditSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required.').max(100, 'Subject is too long (max 100 characters).'),
  sender: z
    .string()
    .refine((v) => v.trim().length === 0 || z.string().email().safeParse(v.trim()).success, 'Sender is invalid.'),
  recipients: z.string(),
  message: z.string(),
});

export type EmailTemplateEditInput = z.infer<typeof emailTemplateEditSchema>;
