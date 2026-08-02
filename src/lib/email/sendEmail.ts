import nodemailer from 'nodemailer';

// Customer-facing transactional email (password reset link, etc.) — legacy sent these via
// `model.util.email.EmailSimple`/a configured SMTP relay. No SMTP credentials exist in this
// environment yet, so this deliberately degrades to logging the email to the server console
// instead of throwing/blocking the flow — the reset-token/expiry logic is real and complete
// either way, it just needs `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`EMAIL_FROM` set
// in `.env` to actually deliver. See docs/decisions/0012-customer-auth.md.
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export type EmailAttachment = { filename: string; content: string | Buffer };

export async function sendEmail(options: {
  to: string;
  cc?: string;
  bcc?: string;
  from?: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
}) {
  const transport = getTransporter();
  if (!transport) {
    console.log(`[email:dev-fallback] No SMTP_HOST configured — logging instead of sending.
To: ${options.to}${options.cc ? `\nCc: ${options.cc}` : ''}${options.bcc ? `\nBcc: ${options.bcc}` : ''}
Subject: ${options.subject}
${options.html ?? options.text ?? ''}${options.attachments ? `\n[${options.attachments.length} attachment(s): ${options.attachments.map((a) => a.filename).join(', ')}]` : ''}`);
    return;
  }
  await transport.sendMail({
    from: options.from ?? process.env.EMAIL_FROM ?? 'no-reply@gzavnili.com',
    to: options.to,
    cc: options.cc,
    bcc: options.bcc,
    subject: options.subject,
    html: options.html,
    text: options.text,
    attachments: options.attachments,
  });
}
