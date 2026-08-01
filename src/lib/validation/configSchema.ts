import { z } from 'zod';

// A `yyyy-mm-dd` from an `<input type="date">`, or blank/absent meaning "no date set".
// Legacy's own `settings.cfm` silently discards an invalid submitted date instead of
// rejecting the form (`isDate(form.dtExpressShip) ? form.dtExpressShip : ""`) — not
// reproduced here since a native date input can't submit a malformed date in the first
// place, so that branch is unreachable through this UI.
const dateInput = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')])
  .nullable()
  .optional();

const textInput = z.string().max(2000).nullable().optional();

// The full bema "Site Settings" screen (legacy `bema/config/settings.cfm`/`vwSettings.cfm`).
// Legacy's own `ValidationBean` here never has a single rule registered, so the submitted
// form is saved with no business validation at all beyond what's below (length caps, which
// are an infra concern, not a ported business rule).
export const siteSettingsSchema = z.object({
  siteMessage: textInput,
  consignee: textInput,

  popupEnabled: z.boolean(),
  popupMessageEn: textInput,
  popupMessageGe: textInput,

  airwayBill: z.string().max(18).nullable().optional(),
  airwayDate: dateInput,

  dtRegularShip: dateInput,
  dtRegularEst: dateInput,
  regAwb: z.string().max(18).nullable().optional(),

  dtExpressShip: dateInput,
  dtExpressEst: dateInput,
  expAwb: z.string().max(18).nullable().optional(),

  dtCargoShip: dateInput,
  dtCargoEst: dateInput,

  crate: z.string().max(50).nullable().optional(),
  declaredPrice: z.string().max(50).nullable().optional(),
  nonDeclaredPrice: z.string().max(50).nullable().optional(),
});

export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>;
