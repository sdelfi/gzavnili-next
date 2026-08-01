import { z } from 'zod';

// "Parcels Reports" date-range filter — legacy's `form.datestart`/`form.dateend` (MM/dd/yyyy
// text inputs + a JS datepicker); this port uses plain HTML5 `type="date"` inputs instead
// (yyyy-mm-dd), matching the rest of this app's admin filter forms (e.g. Pricing Rules
// Administration's From/To Date).
export const parcelsReportQuerySchema = z.object({
  dateStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ParcelsReportQuery = z.infer<typeof parcelsReportQuerySchema>;
