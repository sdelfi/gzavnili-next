import { z } from 'zod';

// `{QUOTEFORM}`/`{QUESTIONFORM}` CMS placeholders (see docs/decisions/0013-site-pages-cms.md's
// "known gap" note and src/components/PageContent/PageContent.tsx) — legacy
// `quote_form.cfm`/`question_form.cfm`. Field values are free-text/select labels (not
// normalized to enums) since they're only ever forwarded into an email body, matching
// legacy's own untyped `url.*` handling.
export const quoteFormSchema = z.object({
  freightType: z.string().min(1),
  cityOfDeparture: z.string().min(1, 'City of departure is required.'),
  weight: z.string().min(1, 'Weight is required.'),
  weightUnit: z.enum(['lb', 'kg', 'g']),
  icoterms: z.string().min(1),
  deliveryCity: z.string().min(1, 'Delivery city is required.'),
  length: z.string().min(1, 'Length is required.'),
  height: z.string().min(1, 'Height is required.'),
  width: z.string().min(1, 'Width is required.'),
  dimensionUnit: z.string().min(1),
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('A valid email is required.'),
  message: z.string().optional(),
});

export const questionFormSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('A valid email is required.'),
  subject: z.string().min(1),
  message: z.string().min(1, 'Message is required.'),
});
