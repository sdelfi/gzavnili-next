'use server';

import { sendEmail } from '@/lib/email/sendEmail';
import { quoteFormSchema, questionFormSchema } from '@/lib/validation/siteFormsSchema';

export type SiteFormActionState =
  | { error?: string; success?: undefined; fieldErrors?: Record<string, string[]> }
  | { success: true; error?: undefined; fieldErrors?: undefined }
  | undefined;

// Free-text fields end up interpolated into an HTML email body below — escaped so a visitor
// can't inject markup into the email an admin reads (legacy's `cfmail` had no such escaping,
// but that's not behavior worth reproducing).
function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Legacy `quote_form.cfm` — mailed to info@gzavnili.com on submit, "Thank You" shown in place
// of the form. `{QUOTEFORM}` is only ever embedded in CMS content (see PageContent.tsx), so
// there's no dedicated page/route for this action to live under.
export async function submitQuoteForm(_prev: SiteFormActionState, formData: FormData): Promise<SiteFormActionState> {
  const parsed = quoteFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: 'Please fill in all required fields.', fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  await sendEmail({
    to: 'info@gzavnili.com',
    subject: 'Quote request',
    html: `
      Name: ${escapeHtml(d.name)}<br>
      Email: ${escapeHtml(d.email)}<br>
      City of departure: ${escapeHtml(d.cityOfDeparture)}<br>
      Delivery city: ${escapeHtml(d.deliveryCity)}<br>
      Freight Type: ${escapeHtml(d.freightType)}<br>
      Icoterms: ${escapeHtml(d.icoterms)}<br>
      Weight: ${escapeHtml(d.weight)} ${escapeHtml(d.weightUnit)}<br>
      Length: ${escapeHtml(d.length)} ${escapeHtml(d.dimensionUnit)}<br>
      Width: ${escapeHtml(d.width)} ${escapeHtml(d.dimensionUnit)}<br>
      Height: ${escapeHtml(d.height)} ${escapeHtml(d.dimensionUnit)}<br>
      Message: ${escapeHtml(d.message ?? '')}
    `,
  });

  return { success: true };
}

// Legacy `question_form.cfm` — same "mail + Thank You" shape as submitQuoteForm above, backs
// the `{QUESTIONFORM}` placeholder instead.
export async function submitQuestionForm(
  _prev: SiteFormActionState,
  formData: FormData,
): Promise<SiteFormActionState> {
  const parsed = questionFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: 'Please fill in all required fields.', fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  await sendEmail({
    to: 'info@gzavnili.com',
    subject: 'Quote request',
    html: `
      Name: ${escapeHtml(d.name)}<br>
      Email: ${escapeHtml(d.email)}<br>
      Subject: ${escapeHtml(d.subject)}<br>
      Message: ${escapeHtml(d.message)}
    `,
  });

  return { success: true };
}
